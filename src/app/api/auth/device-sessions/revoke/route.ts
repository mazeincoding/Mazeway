import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TRevokeDeviceSessionsResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { revokeDeviceSessionsSchema } from "@/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { getCurrentDeviceSession } from "@/utils/auth/device-sessions/server";

/**
 * Deletes one or all device sessions. Security is enforced through multiple layers:
 * 1. Validates the auth token via getUser() to ensure the request is authenticated
 * 2. Verifies the authenticated user owns the device session(s) they're trying to delete
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
    let requestBody: {
      sessionId?: string;
      revokeAll?: boolean;
    };
    try {
      const rawBody = await request.json();
      const validation = revokeDeviceSessionsSchema.safeParse(rawBody);
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

      // Validate we have either sessionId or revokeAll
      if (!requestBody.sessionId && !requestBody.revokeAll) {
        return NextResponse.json(
          { error: "Must provide either sessionId or revokeAll" },
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

    // Verify current device session using the utility
    const {
      deviceSession: currentSession,
      isValid,
      error: currentSessionError,
    } = await getCurrentDeviceSession({ request, supabase, user });

    if (!isValid || !currentSession) {
      console.error("Current device session invalid or expired", {
        userId: user.id,
        error: currentSessionError?.message,
      });
      // Let the generic error handler catch this to return 500 or 401 appropriately
      throw new Error(
        currentSessionError?.message ||
          "Current device session is invalid or expired"
      );
    }

    // Check if verification is needed based on grace period
    const needsVerification = await hasGracePeriodExpired({
      deviceSessionId: currentSession.id,
      supabase,
    });

    // If verification is needed, return requirements and stop
    if (needsVerification) {
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

      return NextResponse.json({
        requiresVerification: true,
        availableMethods,
      }) satisfies NextResponse<TRevokeDeviceSessionsResponse>;
    }

    // --- Verification passed or not required ---

    // Log sensitive action verification
    await logAccountEvent({
      user_id: user.id,
      event_type: "SENSITIVE_ACTION_VERIFIED",
      device_session_id: currentSession.id,
      metadata: {
        device: {
          device_name: currentSession.device.device_name,
          browser: currentSession.device.browser,
          os: currentSession.device.os,
          ip_address: currentSession.device.ip_address,
        },
        action: requestBody.revokeAll
          ? "revoke_all_other_devices"
          : "revoke_device",
        category: "warning",
        description: requestBody.revokeAll
          ? "Revoke all other devices request verified"
          : "Device revocation request verified",
      },
    });

    // Handle single session revocation
    if (requestBody.sessionId) {
      console.log("[DEBUG] Attempting to revoke session", {
        sessionId: requestBody.sessionId,
        userId: user.id,
        currentSessionId: currentSession.id,
      });

      // Verify session ownership and get device info for alert
      const { data: sessionToRevoke, error: sessionError } = await supabase
        .from("device_sessions")
        .select(
          `
          *,
          device:devices(*)
        `
        )
        .eq("id", requestBody.sessionId)
        .eq("user_id", user.id)
        .single();

      console.log("[DEBUG] Session lookup result", {
        hasSession: !!sessionToRevoke,
        error: sessionError
          ? {
              code: sessionError.code,
              message: sessionError.message,
              details: sessionError.details,
            }
          : null,
        sessionDetails: sessionToRevoke
          ? {
              id: sessionToRevoke.id,
              userId: sessionToRevoke.user_id,
              deviceInfo: sessionToRevoke.device,
            }
          : null,
      });

      if (sessionError || !sessionToRevoke) {
        console.error("Session ownership verification failed", {
          sessionError,
          sessionToRevoke,
        });
        // Check if this might be a case of already revoked session
        const { data: sessionExists } = await supabase
          .from("device_sessions")
          .select("id")
          .eq("id", requestBody.sessionId)
          .maybeSingle();

        if (!sessionExists) {
          return NextResponse.json(
            { error: "Session already revoked or does not exist" },
            { status: 404 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }
        throw new Error("Session not found or unauthorized");
      }

      // Log the device revocation event BEFORE deleting the session
      await logAccountEvent({
        user_id: user.id,
        event_type: "DEVICE_REVOKED",
        device_session_id: requestBody.sessionId,
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
            error:
              emailError instanceof Error ? emailError.message : emailError,
            stack: emailError instanceof Error ? emailError.stack : undefined,
            config: {
              enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
              alertOnRevoke:
                AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
            },
          });
        }
      }

      // Delete the session
      const { error: deleteError } = await supabaseAdmin
        .from("device_sessions")
        .delete()
        .eq("id", requestBody.sessionId);

      if (deleteError) {
        console.error("Failed to delete device session", { deleteError });
        throw deleteError;
      }

      // If we're revoking our own session, clear cookies and logout
      if (requestBody.sessionId === currentSession.id) {
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
    }

    // Handle revoking all sessions
    if (requestBody.revokeAll) {
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
        .neq("id", currentSession.id); // Exclude the current session

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
            error:
              emailError instanceof Error ? emailError.message : emailError,
            stack: emailError instanceof Error ? emailError.stack : undefined,
            config: {
              enabled: AUTH_CONFIG.emailAlerts.deviceSessions.enabled,
              alertOnRevoke:
                AUTH_CONFIG.emailAlerts.deviceSessions.alertOnRevoke,
            },
          });
        }
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
    }

    // This should never happen due to validation above
    return NextResponse.json(
      { error: "Invalid request - must specify sessionId or revokeAll" },
      { status: 400 }
    ) satisfies NextResponse<TApiErrorResponse>;
  } catch (error) {
    const err = error as Error;
    console.error("Error in revoke handler:", err);
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
