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
 * Deletes all device sessions except the current one.
 * Similar security enforcement as single session deletion:
 * 1. Validates auth token.
 * 2. Requires verification based on the current session's grace period.
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
    // Validate auth token
    const { user, error: userError } = await getUser({ supabase });
    if (userError || !user) {
      console.error("Authentication failed", { error: userError });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get current device session ID
    const currentSessionId = getCurrentDeviceSessionId(request);
    if (!currentSessionId) {
      console.error("No device session found in cookie");
      throw new Error("No device session found");
    }

    // Parse and validate request body
    let requestBody: TRevokeAllDeviceSessionsRequest;
    try {
      const rawBody = await request.json();
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

    // Verify current device session is valid and get its info
    const { data: currentSession, error: currentSessionError } = (await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
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

    // Check if verification is needed based on grace period
    const needsVerification = await hasGracePeriodExpired({
      deviceSessionId: currentSessionId,
      supabase,
    });

    // If checking requirements or verification is needed, handle that first
    if (requestBody.checkVerificationOnly || needsVerification) {
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      const availableMethods = has2FA
        ? factors
        : methods.map((method) => ({ type: method, factorId: method }));

      if (availableMethods.length === 0 && has2FA) {
        console.error("No 2FA methods available for required verification");
        return NextResponse.json(
          { error: "No verification methods available" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      if (requestBody.checkVerificationOnly) {
        return NextResponse.json({
          requiresVerification: needsVerification,
          availableMethods: needsVerification ? availableMethods : undefined,
        }) satisfies NextResponse<TRevokeAllDeviceSessionsResponse>;
      }

      if (needsVerification) {
        return NextResponse.json({
          requiresVerification: true,
          availableMethods,
        }) satisfies NextResponse<TRevokeAllDeviceSessionsResponse>;
      }
    }

    // --- Verification passed or not required ---

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
        action: "revoke_all_other_devices",
        category: "warning",
        description: "Revoke all other devices request verified",
      },
    });

    // Fetch all other sessions for the user
    const { data: sessionsToRevoke, error: fetchError } = await supabaseAdmin
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("user_id", user.id)
      .neq("id", currentSessionId); // Exclude the current session

    if (fetchError) {
      console.error("Failed to fetch other device sessions", { fetchError });
      throw fetchError;
    }

    if (!sessionsToRevoke || sessionsToRevoke.length === 0) {
      console.log("No other device sessions to revoke");
      return NextResponse.json({}); // Nothing to do
    }

    // Log revocation events for each session
    const revokePromises = sessionsToRevoke.map((session) =>
      logAccountEvent({
        user_id: user.id,
        event_type: "DEVICE_REVOKED_ALL",
        device_session_id: session.id,
        metadata: {
          device: {
            device_name: session.device.device_name,
            browser: session.device.browser,
            os: session.device.os,
            ip_address: session.device.ip_address,
          },
          category: "warning",
          description: `Device revoked (part of revoke all): ${session.device?.browser || "Unknown"} on ${session.device?.os || "Unknown"}`,
        },
      })
    );
    await Promise.all(revokePromises);

    // Send a single email alert
    if (
      AUTH_CONFIG.emailAlerts.deviceSessions.enabled &&
      AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke
    ) {
      try {
        await sendEmailAlert({
          request,
          origin,
          user,
          title: "Access Revoked for Multiple Devices",
          message: `Access for ${sessionsToRevoke.length} other device(s) was revoked. If this wasn't you, secure your account immediately.`,
          device: {
            user_id: user.id,
            device_name: currentSession.device.device_name,
            browser: currentSession.device.browser,
            os: currentSession.device.os,
            ip_address: currentSession.device.ip_address,
          },
        });
      } catch (emailError) {
        console.error("Failed to send bulk revoke email alert", {
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

    // Delete the sessions
    const sessionIdsToDelete = sessionsToRevoke.map((s) => s.id);
    const { error: deleteError } = await supabaseAdmin
      .from("device_sessions")
      .delete()
      .in("id", sessionIdsToDelete);

    if (deleteError) {
      console.error("Failed to delete device sessions", { deleteError });
      throw deleteError;
    }

    console.log(
      `Revoked ${sessionsToRevoke.length} device sessions for user ${user.id}`
    );
    return NextResponse.json({});
  } catch (error) {
    const err = error as Error;
    console.error("Error in revoke-all handler:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
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
