import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TRevokeDeviceSessionResponse,
  TRevokeDeviceSessionRequest,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { revokeDeviceSessionSchema } from "@/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { TDeviceInfo } from "@/types/auth";

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
      console.error("Authentication failed", { error });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get current device session ID from cookie
    const currentSessionId = getCurrentDeviceSessionId(request);
    if (!currentSessionId) {
      console.error("No device session found in cookie");
      throw new Error("No device session found");
    }

    // Parse and validate request body
    let requestBody: TRevokeDeviceSessionRequest;
    try {
      const rawBody = await request.json();

      // Use Zod schema for validation
      const validation = revokeDeviceSessionSchema.safeParse(rawBody);

      if (!validation.success) {
        console.error("Request body validation failed", {
          errors: validation.error.issues,
        });
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
        console.error("Session ID mismatch", {
          urlSessionId: sessionId,
          bodySessionId: requestBody.sessionId,
        });
        return NextResponse.json(
          { error: "Session ID mismatch between URL and request body" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    } catch (e) {
      console.error("Failed to parse request body", {
        error: e instanceof Error ? e.message : e,
      });
      return NextResponse.json(
        { error: "Missing or invalid JSON in request body" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Verify current device session is valid and not expired
    const { data: currentSession, error: currentSessionError } = (await supabase
      .from("device_sessions")
      .select("id, device:devices(*)")
      .eq("id", currentSessionId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .single()) as unknown as { data: { device: TDeviceInfo }; error: Error };

    if (currentSessionError || !currentSession) {
      console.error("Current device session invalid or expired", {
        error: currentSessionError,
        session: currentSession,
      });
      throw new Error("Current device session is invalid or expired");
    }

    // Second security layer: Verify session ownership and get device info for alert
    const { data: sessionToRevoke, error: sessionError } = await supabase
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

    if (sessionError || !sessionToRevoke) {
      console.error("Session ownership verification failed", {
        sessionError,
        sessionToRevoke,
      });
      throw new Error("Session not found or unauthorized");
    }

    // Check if verification is needed based on grace period
    const needsVerification = await hasGracePeriodExpired({
      deviceSessionId: currentSessionId,
      supabase,
    });

    if (needsVerification) {
      // Get available verification methods
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      // If user has 2FA, they must use it
      if (has2FA) {
        return NextResponse.json({
          requiresVerification: true,
          availableMethods: factors,
          sessionId,
        }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
      }

      // Otherwise they can use basic verification methods
      const availableMethods = methods.map((method) => ({
        type: method,
        factorId: method, // For non-2FA methods, use method name as factorId
      }));

      if (availableMethods.length === 0) {
        console.error("No verification methods available");
        return NextResponse.json(
          { error: "No verification methods available" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      return NextResponse.json({
        requiresVerification: true,
        availableMethods,
        sessionId,
      }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
    }

    // If we reach here, user is verified within grace period
    const adminClient = await createClient({ useServiceRole: true });

    // Log sensitive action verification
    await logAccountEvent({
      // We could technically use currentSession.device.user_id
      // But it's less secure than using the authenticated user's ID which is verified
      user_id: user.id,
      event_type: "SENSITIVE_ACTION_VERIFIED",
      device_session_id: currentSessionId,
      metadata: {
        device: {
          device_name: currentSession.device.device_name,
          browser: currentSession.device.browser,
          os: currentSession.device.os,
          ip_address: currentSession.device.ip_address,
        },
        action: "revoke_device",
        category: "warning",
        description: "Device revocation request verified",
      },
    });

    // Log the device revocation event BEFORE deleting the session
    await logAccountEvent({
      // We could technically use currentSession.device.user_id
      // But it's less secure than using the authenticated user's ID which is verified
      user_id: user.id,
      event_type: "DEVICE_REVOKED",
      device_session_id: sessionId,
      metadata: {
        device: {
          device_name: sessionToRevoke.device.device_name,
          browser: sessionToRevoke.device.browser,
          os: sessionToRevoke.device.os,
          ip_address: sessionToRevoke.device.ip_address,
        },
        category: "warning",
        description: `Device revoked: ${sessionToRevoke.device.browser || "Unknown browser"} on ${sessionToRevoke.device.os || "Unknown OS"}`,
      },
    });

    // Send alert for device revocation if enabled
    if (
      AUTH_CONFIG.emailAlerts.deviceSessions.enabled &&
      AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke
    ) {
      try {
        await sendEmailAlert({
          request,
          origin,
          user,
          title: "Device access revoked",
          message: `A device's access to your account was revoked. If this wasn't you, please secure your account immediately.`,
          revokedDevice: {
            user_id: user.id,
            device_name: sessionToRevoke.device.device_name,
            browser: sessionToRevoke.device.browser,
            os: sessionToRevoke.device.os,
            ip_address: sessionToRevoke.device.ip_address,
          },
          device: {
            user_id: user.id,
            device_name: currentSession.device.device_name,
            browser: currentSession.device.browser,
            os: currentSession.device.os,
            ip_address: currentSession.device.ip_address,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email alert", {
          error: emailError instanceof Error ? emailError.message : emailError,
          stack: emailError instanceof Error ? emailError.stack : undefined,
          config: {
            enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
            alertOnRevoke: AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
          },
        });
      }
    } else {
      console.log("Email alerts disabled for device revocation", {
        enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
        alertOnRevoke: AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
      });
    }

    // Delete the session AFTER logging the events
    const { error: deleteError } = await adminClient
      .from("device_sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteError) {
      console.error("Failed to delete device session", { deleteError });
      throw deleteError;
    }

    // If we're revoking our own session, clear cookies and logout
    if (sessionId === currentSessionId) {
      // Clear device session cookie
      const response = NextResponse.json({});
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

    return NextResponse.json({});
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
