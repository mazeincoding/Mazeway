import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TEmptySuccessResponse,
  TRevokeDeviceSessionResponse,
  TRevokeDeviceSessionRequest,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
  getDeviceSessionId,
} from "@/utils/auth";
import { revokeDeviceSessionSchema } from "@/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";

/**
 * Deletes a device session. Security is enforced through multiple layers:
 * 1. Validates the auth token via getUser() to ensure the request is authenticated
 * 2. Verifies the authenticated user owns the device session they're trying to delete
 * 3. Requires verification for sensitive actions if needed
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { origin } = new URL(request.url);
  // Even though TypeScript thinks "await" doesn't have an effect
  // It does. It's required in Next.js dynamic API routes
  const sessionId = (await params).id;

  if (apiRateLimit) {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }
  }

  const supabase = await createClient();
  const supabaseAdmin = await createClient({ useServiceRole: true });
  try {
    // First security layer: Validate auth token
    const { user, error } = await getUser({ supabase });
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get current device session ID from cookie
    const currentSessionId = getDeviceSessionId(request);
    if (!currentSessionId) throw new Error("No device session found");

    // Parse and validate request body
    let requestBody: TRevokeDeviceSessionRequest;
    try {
      const rawBody = await request.json();

      // Use Zod schema for validation
      const validation = revokeDeviceSessionSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            error:
              validation.error.issues[0]?.message || "Invalid request body",
          },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      requestBody = validation.data;

      // Validate session ID matches URL parameter
      if (requestBody.sessionId !== sessionId) {
        return NextResponse.json(
          { error: "Session ID mismatch between URL and request body" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Missing or invalid JSON in request body" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Verify current device session is valid and not expired
    const { data: currentSession, error: currentSessionError } = await supabase
      .from("device_sessions")
      .select("id")
      .eq("id", currentSessionId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (currentSessionError || !currentSession) {
      throw new Error("Current device session is invalid or expired");
    }

    // Second security layer: Verify session ownership and get device info for alert
    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      console.error("Session not found or unauthorized", {
        sessionError,
        session,
      });
      throw new Error("Session not found or unauthorized");
    }

    // Check if verification is needed based on config and grace period
    const needsVerification =
      AUTH_CONFIG.requireFreshVerification.revokeDevices &&
      (await hasGracePeriodExpired({
        deviceSessionId: currentSessionId,
        supabase,
      }));

    if (needsVerification) {
      // Get available verification methods
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      // Return available methods for verification
      if (has2FA) {
        return NextResponse.json({
          requiresTwoFactor: true,
          availableMethods: factors,
          sessionId,
        }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
      } else {
        // Return available non-2FA methods
        const availableMethods = methods.map((method) => ({
          type: method,
          factorId: method, // For non-2FA methods, use method name as factorId
        }));

        if (availableMethods.length === 0) {
          return NextResponse.json(
            { error: "No verification methods available" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        return NextResponse.json({
          requiresTwoFactor: false,
          availableMethods,
          sessionId,
        }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
      }
    }

    // If we reach here, user is verified within grace period
    const adminClient = await createClient({ useServiceRole: true });

    // Log sensitive action verification
    await logAccountEvent({
      user_id: user.id,
      event_type: "SENSITIVE_ACTION_VERIFIED",
      device_session_id: currentSessionId,
      metadata: {
        device: {
          device_name: session.device.device_name,
          browser: session.device.browser,
          os: session.device.os,
          ip_address: session.device.ip_address,
        },
        action: "revoke_device",
        category: "warning",
        description: "Device revocation request verified",
      },
    });

    // Log the device revocation event BEFORE deleting the session
    await logAccountEvent({
      user_id: user.id,
      event_type: "DEVICE_REVOKED",
      device_session_id: sessionId,
      metadata: {
        device: {
          device_name: session.device.device_name,
          browser: session.device.browser,
          os: session.device.os,
          ip_address: session.device.ip_address,
        },
        category: "warning",
        description: `Device revoked: ${session.device.browser || "Unknown browser"} on ${session.device.os || "Unknown OS"}`,
      },
    });

    // Send alert for device revocation if enabled
    if (
      AUTH_CONFIG.emailAlerts.deviceSessions.enabled &&
      AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke
    ) {
      console.log(
        "[DEBUG] Attempting to send email alert for device revocation",
        {
          enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
          alertOnRevoke: AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
          deviceInfo: {
            name: session.device.device_name,
            browser: session.device.browser,
            os: session.device.os,
          },
          origin,
          userId: user.id,
          email: user.email,
        }
      );

      try {
        await sendEmailAlert({
          request,
          origin,
          user,
          title: "Device access revoked",
          message: `A device's access to your account was revoked. If this wasn't you, please secure your account immediately.`,
          revokedDevice: {
            device_name: session.device.device_name,
            browser: session.device.browser,
            os: session.device.os,
            ip_address: session.device.ip_address,
          },
        });
        console.log("[DEBUG] Email alert sent successfully");
      } catch (emailError) {
        console.error("[DEBUG] Failed to send email alert", {
          error: emailError instanceof Error ? emailError.message : emailError,
          stack: emailError instanceof Error ? emailError.stack : undefined,
          config: {
            enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
            alertOnRevoke: AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
          },
        });
        // Don't throw the error - we still want to complete the device revocation
      }
    } else {
      console.log("[DEBUG] Email alerts disabled for device revocation", {
        enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
        alertOnRevoke: AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
      });
    }

    // Delete the session AFTER logging the events
    const { error: deleteError } = await adminClient
      .from("device_sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteError) throw deleteError;

    // If we're revoking our own session, clear cookies and logout
    if (sessionId === currentSessionId) {
      // Clear device session cookie
      const response = NextResponse.json(
        {}
      ) satisfies NextResponse<TEmptySuccessResponse>;
      response.cookies.delete("device_session_id");

      // Call logout endpoint to clear Supabase session
      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      });

      return response;
    }

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error &&
          (error.message === "Unauthorized" ||
            error.message === "Session not found or unauthorized")
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
