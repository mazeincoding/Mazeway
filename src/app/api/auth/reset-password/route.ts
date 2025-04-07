/**
 * This route is for users with recovery sessions (from password reset email)
 * to set a new password. It requires only the new password, unlike the
 * change-password route which requires both current and new password.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/validation/auth-validation";
import {
  TApiErrorResponse,
  TResetPasswordRequest,
  TResetPasswordResponse,
} from "@/types/api";
import { TAAL } from "@/types/auth";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { verifyRecoveryToken } from "@/utils/auth/recovery-token";
import { AUTH_CONFIG } from "@/config/auth";
import {
  getUserVerificationMethods,
  getAuthenticatorAssuranceLevel,
  getUser,
} from "@/utils/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { UAParser } from "ua-parser-js";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    // Regular client for 2FA checks
    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });
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
      const { user, error } = await getUser({ supabase });
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

    console.log("Raw body", rawBody);

    // Validate using just the password field, not the full reset password schema
    // because the API only receives password (not confirmPassword)
    const validation = authSchema.shape.password.safeParse(rawBody.password);

    console.log("Validation", validation);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid password" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TResetPasswordRequest = {
      password: validation.data,
    };

    // Check if 2FA is required - only if we're not requiring relogin
    if (!AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      const currentSessionId = getCurrentDeviceSessionId(request);
      if (!currentSessionId) {
        throw new Error("No device session found");
      }

      // Check if user has 2FA enabled
      const { has2FA, factors } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

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
      ? await supabaseAdmin.auth.admin.updateUserById(userId, {
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

    // Send alert for password reset if enabled
    if (
      AUTH_CONFIG.emailAlerts.passwordChange.enabled &&
      AUTH_CONFIG.emailAlerts.passwordChange.alertOnReset
    ) {
      // Get user email since we only have ID
      const { data: userData } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId)
        .single();

      const parser = new UAParser(request.headers.get("user-agent") || "");

      if (userData?.email) {
        await sendEmailAlert({
          request,
          origin,
          user: { id: userId, email: userData.email },
          title: "Your password has been reset",
          message:
            "Your account password has been reset through the forgot password flow. If this wasn't you, please secure your account immediately.",
          device: {
            user_id: userId,
            device_name: parser.getDevice().model || "Unknown Device",
            browser: parser.getBrowser().name || null,
            os: parser.getOS().name || null,
            ip_address: getClientIp(request),
          },
        });
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
