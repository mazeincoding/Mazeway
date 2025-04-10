import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TRevokeAllDeviceSessionsResponse,
  TRevokeAllDeviceSessionsRequest,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { revokeAllDeviceSessionsSchema } from "@/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { TDeviceInfo } from "@/types/auth";

/**
 * Revokes all device sessions except the current one. Security is enforced through multiple layers:
 * 1. Validates the auth token via getUser() to ensure the request is authenticated
 * 2. Verifies the authenticated user owns the device sessions they're trying to delete
 * 3. Requires verification for sensitive actions if needed
 */
export async function DELETE(request: NextRequest) {
  const { origin } = new URL(request.url);

  if (apiRateLimit) {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  }

  const supabase = await createClient();
  const supabaseAdmin = await createClient({ useServiceRole: true });

  try {
    // Parse and validate request body
    let requestBody: TRevokeAllDeviceSessionsRequest;
    try {
      const rawBody = await request.json();

      // Use Zod schema for validation
      const validation = revokeAllDeviceSessionsSchema.safeParse(rawBody);

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
    } catch (e) {
      console.error("Failed to parse request body", {
        error: e instanceof Error ? e.message : e,
      });
      return NextResponse.json(
        { error: "Missing or invalid JSON in request body" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { checkVerificationOnly } = requestBody;

    // First security layer: Validate auth token
    const { user, error } = await getUser({ supabase });
    if (error || !user) {
      console.error("Authentication failed", { error });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the current session ID from cookie
    const currentSessionId = getCurrentDeviceSessionId(request);
    if (!currentSessionId) {
      console.error("No device session found in cookie");
      return NextResponse.json(
        { error: "No device session found" },
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
      return NextResponse.json(
        { error: "Current device session is invalid or expired" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed based on grace period
    const needsVerification = await hasGracePeriodExpired({
      deviceSessionId: currentSessionId,
      supabase,
    });

    // If verification is needed, return available methods
    if (needsVerification) {
      // Get available verification methods
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      // If we're just checking requirements, check verification status
      if (checkVerificationOnly) {
        // If user has 2FA, they must use it
        if (has2FA) {
          return NextResponse.json({
            requiresVerification: true,
            availableMethods: factors,
          }) satisfies NextResponse<TRevokeAllDeviceSessionsResponse>;
        } else {
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
          }) satisfies NextResponse<TRevokeAllDeviceSessionsResponse>;
        }
      }

      // Otherwise, return an error
      return NextResponse.json(
        { error: "Verification required" },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get all sessions except the current one
    const { data: sessionsToRevoke, error: sessionsError } = await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("user_id", user.id)
      .neq("id", currentSessionId);

    if (sessionsError) {
      console.error("Failed to fetch device sessions", { sessionsError });
      throw sessionsError;
    }

    // If we're just checking verification, return success
    if (checkVerificationOnly) {
      return NextResponse.json({
        requiresVerification: false,
      } satisfies TRevokeAllDeviceSessionsResponse);
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
          device_name: currentSession.device.device_name,
          browser: currentSession.device.browser,
          os: currentSession.device.os,
          ip_address: currentSession.device.ip_address,
        },
        action: "revoke_all_devices",
        category: "warning",
        description: "Bulk device revocation request verified",
      },
    });

    // Log the device revocation event for each session
    for (const session of sessionsToRevoke) {
      await logAccountEvent({
        user_id: user.id,
        event_type: "DEVICE_REVOKED",
        device_session_id: session.id,
        metadata: {
          device: {
            device_name: session.device.device_name,
            browser: session.device.browser,
            os: session.device.os,
            ip_address: session.device.ip_address,
          },
          category: "warning",
          description: `Device revoked: ${session.device.browser || "Unknown browser"} on ${session.device.os || "Unknown OS"} (bulk operation)`,
        },
      });
    }

    // Send alert for bulk device revocation if enabled
    if (
      AUTH_CONFIG.emailAlerts.deviceSessions.enabled &&
      AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke &&
      sessionsToRevoke.length > 0
    ) {
      try {
        await sendEmailAlert({
          request,
          origin,
          user,
          title: "Multiple devices logged out",
          message: `${sessionsToRevoke.length} device${
            sessionsToRevoke.length === 1 ? "" : "s"
          } were logged out from your account. If this wasn't you, please secure your account immediately.`,
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
        });
      }
    }

    // Delete all sessions except the current one
    if (sessionsToRevoke.length > 0) {
      const { error: deleteError } = await adminClient
        .from("device_sessions")
        .delete()
        .eq("user_id", user.id)
        .neq("id", currentSessionId);

      if (deleteError) {
        console.error("Failed to delete device sessions", { deleteError });
        throw deleteError;
      }
    }

    // Return success with count of revoked sessions
    return NextResponse.json({
      revokedCount: sessionsToRevoke.length,
    } satisfies TRevokeAllDeviceSessionsResponse);
  } catch (error) {
    const err = error as Error;
    console.error("Error revoking all device sessions:", {
      error: err.message,
      stack: err.stack,
    });

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
