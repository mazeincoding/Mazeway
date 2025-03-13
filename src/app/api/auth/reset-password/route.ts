/**
 * This route is for users with recovery sessions (from password reset email)
 * to set a new password. It requires only the new password, unlike the
 * change-password route which requires both current and new password.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/utils/validation/auth-validation";
import {
  TApiErrorResponse,
  TResetPasswordRequest,
  TResetPasswordResponse,
  TSendEmailAlertRequest,
} from "@/types/api";
import { TAAL } from "@/types/auth";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { verifyRecoveryToken } from "@/utils/auth/recovery-token";
import { AUTH_CONFIG } from "@/config/auth";
import {
  getUserVerificationMethods,
  getAuthenticatorAssuranceLevel,
  getUser,
  getDeviceSessionId,
} from "@/utils/auth";
import { setupDeviceSession } from "@/utils/device-sessions/server";
import { UAParser } from "ua-parser-js";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    // Regular client for 2FA checks
    const supabase = await createClient();
    // Service role client for admin operations
    const adminClient = await createClient({ useServiceRole: true });
    let userId: string | null = null;

    // If re-login is required, verify recovery token
    if (AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      const recoveryToken = request.cookies.get("recovery_session")?.value;
      if (!recoveryToken) {
        return NextResponse.json(
          { error: "Invalid password reset session" },
          { status: 401 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      userId = verifyRecoveryToken(recoveryToken);
      if (!userId) {
        return NextResponse.json(
          { error: "Invalid or expired recovery session" },
          { status: 401 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    } else {
      // Otherwise verify current user through Supabase
      const { user, error } = await getUser(supabase);
      if (error || !user) {
        return NextResponse.json(
          { error: "No authenticated user" },
          { status: 401 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
      userId = user.id;
    }

    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Get and validate request body
    const rawBody = await request.json();
    const validation = authSchema.shape.password.safeParse(rawBody.password);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid password" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TResetPasswordRequest = { password: validation.data };

    // Check if 2FA is required - only if we're not requiring relogin
    if (!AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      const currentSessionId = getDeviceSessionId(request);
      if (!currentSessionId) {
        throw new Error("No device session found");
      }

      // Check if user has 2FA enabled
      const { has2FA, factors } = await getUserVerificationMethods(supabase);

      if (has2FA) {
        // For password reset, always require 2FA verification if enabled
        const currentLevel = await getAuthenticatorAssuranceLevel(
          supabase,
          currentSessionId
        );

        if (currentLevel !== ("aal2" satisfies TAAL)) {
          return NextResponse.json({
            requiresTwoFactor: true,
            availableMethods: factors,
            factorId: factors[0].factorId,
            newPassword: body.password,
          }) satisfies NextResponse<TResetPasswordResponse>;
        }
      }
    }

    // Update password using appropriate method and client
    const { error: updateError } = AUTH_CONFIG.passwordReset
      .requireReloginAfterReset
      ? await adminClient.auth.admin.updateUserById(userId, {
          password: body.password,
        })
      : await supabase.auth.updateUser({ password: body.password });

    if (updateError) {
      console.error("Failed to reset password:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to reset password" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Set has_password flag after successful password reset
    const { error: flagError } = await supabase
      .from("users")
      .update({ has_password: true })
      .eq("id", userId);

    if (flagError) {
      // Continue anyway - password was reset successfully
    }

    if (
      AUTH_CONFIG.emailAlerts.password.enabled &&
      AUTH_CONFIG.emailAlerts.password.alertOnReset
    ) {
      try {
        // Get user email since we only have ID
        const { data: userData } = await supabase
          .from("users")
          .select("email")
          .eq("id", userId)
          .single();

        if (userData?.email) {
          const parser = new UAParser(request.headers.get("user-agent") || "");
          const deviceName = parser.getDevice().model || "Unknown Device";
          const browser = parser.getBrowser().name || "Unknown Browser";
          const os = parser.getOS().name || "Unknown OS";

          const body: TSendEmailAlertRequest = {
            email: userData.email,
            title: "Your password has been reset",
            message:
              "Your account password has been reset through the forgot password flow. If this wasn't you, please secure your account immediately.",
            device: {
              user_id: userId,
              device_name: deviceName,
              browser,
              os,
              ip_address: request.headers.get("x-forwarded-for") || "::1",
            },
          };

          const emailAlertResponse = await fetch(
            `${origin}/api/auth/send-email-alert`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
              },
              body: JSON.stringify(body),
            }
          );

          if (!emailAlertResponse.ok) {
            console.error("Failed to send password reset alert", {
              status: emailAlertResponse.status,
              statusText: emailAlertResponse.statusText,
            });
          }
        }
      } catch (error) {
        console.error("Error sending password reset alert:", error);
        // Don't throw - password was reset successfully
      }
    }

    // Create success response with login required flag
    const response = NextResponse.json(
      {
        requiresTwoFactor: false,
        loginRequired: AUTH_CONFIG.passwordReset.requireReloginAfterReset,
        shouldRefreshUser: !AUTH_CONFIG.passwordReset.requireReloginAfterReset,
        redirectTo: AUTH_CONFIG.passwordReset.requireReloginAfterReset
          ? `/auth/login?message=${encodeURIComponent(
              "Password reset successful. Please log in with your new password."
            )}`
          : "/dashboard",
      },
      { status: 200 }
    ) satisfies NextResponse<TResetPasswordResponse>;

    // Set up device session if not requiring relogin
    if (!AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      const session_id = await setupDeviceSession(request, userId, {
        trustLevel: "high",
        skipVerification: true, // User proved ownership via email
        provider: "browser",
      });

      // Set device session cookie
      response.cookies.set("device_session_id", session_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: AUTH_CONFIG.deviceSessions.maxAge * 24 * 60 * 60, // Convert days to seconds
      });
    }

    // Clear recovery cookie if it was used
    if (AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      response.cookies.set("recovery_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Error in reset password:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
