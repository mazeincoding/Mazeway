/**
 * This route is for:
 * 1. Authenticated users that want to change their password
 * 2. OAuth users that want to add a password to their account
 *
 * For users that signed up with email/password:
 * - Requires current password verification
 * - Updates to new password if verification succeeds
 *
 * For users that signed up with OAuth:
 * - Skips current password verification
 * - Adds password to their account
 * - Keeps OAuth provider connected
 */

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TChangePasswordRequest,
  TChangePasswordResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  hasGracePeriodExpired,
  getUserVerificationMethods,
  getUser,
  verifyPassword,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import {
  passwordChangeSchema,
  addPasswordSchema,
  type PasswordChangeSchema,
} from "@/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { UAParser } from "ua-parser-js";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    // Rate limiting
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        console.warn(`[Password Change] Rate limit exceeded for IP: ${ip}`);
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
          },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { user, error } = await getUser({ supabase });
    if (error || !user) {
      console.error("[Password Change] Unauthorized access attempt:", error);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get user data including has_password
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("has_password")
      .eq("id", user.id)
      .single();

    if (dbError || !dbUser) {
      console.error("[Password Change] Failed to fetch user data:", dbError);
      return NextResponse.json(
        { error: "Failed to get user data" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TChangePasswordRequest = await request.json();

    // Validate password change data
    const validation = (
      dbUser.has_password ? passwordChangeSchema : addPasswordSchema
    ).safeParse(body);
    if (!validation.success) {
      console.warn(
        "[Password Change] Validation failed:",
        validation.error.issues
      );
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Type-safe way to handle both schemas
    const { newPassword } = validation.data;
    const currentPassword = dbUser.has_password
      ? (validation.data as PasswordChangeSchema).currentPassword
      : undefined;

    // For users with password auth, verify current password
    if (dbUser.has_password) {
      if (!currentPassword) {
        console.warn(
          "[Password Change] Current password missing for password change"
        );
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      // Verify password using our utility function
      const { isValid, error: verifyError } = await verifyPassword({
        supabase,
        password: currentPassword,
      });

      if (verifyError) {
        console.error(
          "[Password Change] Error verifying password:",
          verifyError
        );
        return NextResponse.json(
          { error: "Failed to verify current password" },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      if (!isValid) {
        console.warn("[Password Change] Invalid current password");
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Get device session ID from cookie
    const deviceSessionId = getCurrentDeviceSessionId(request);
    if (!deviceSessionId) {
      console.error("[Password Change] No device session found in request");
      return NextResponse.json(
        { error: "No device session found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed
    const gracePeriodExpired = await hasGracePeriodExpired({
      supabase,
      deviceSessionId,
    });

    // Determine if verification is needed based on grace period
    const needsVerification = gracePeriodExpired && dbUser.has_password;

    if (needsVerification) {
      // Check if user has 2FA enabled
      const { has2FA, factors } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      if (has2FA) {
        return NextResponse.json({
          requiresTwoFactor: true,
          availableMethods: factors,
        }) satisfies NextResponse<TChangePasswordResponse>;
      }
    }

    // Log sensitive action verification
    const parser = new UAParser(request.headers.get("user-agent") || "");
    await logAccountEvent({
      user_id: user.id,
      event_type: "SENSITIVE_ACTION_VERIFIED",
      device_session_id: deviceSessionId,
      metadata: {
        device: {
          device_name: parser.getDevice().model || "Unknown Device",
          browser: parser.getBrowser().name || null,
          os: parser.getOS().name || null,
          ip_address: getClientIp(request),
        },
        action: "change_password",
        category: "info",
        description: "Password change request verified",
      },
    });

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[Password Change] Update error:", updateError);

      // Check for AAL2 error specifically
      if (updateError.code === "insufficient_aal") {
        return NextResponse.json(
          {
            error:
              "Your session security level is too low. Please log out and log back in with 2FA to change your password.",
            code: "insufficient_aal",
          },
          { status: 403 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      // Special handling for OAuth users
      if (dbUser.has_password && updateError.code === "identity_not_found") {
        console.error("[Password Change] OAuth user password update failed");
        return NextResponse.json(
          { error: "Cannot add password. Please contact support." },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      throw updateError;
    }

    // For OAuth users adding a password the first time, add email provider
    let requiresRelogin = false;
    if (!dbUser.has_password) {
      // Force add the email identity using admin API
      const { error: adminError } =
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email: user.email,
          password: newPassword,
          email_confirm: true,
        });

      if (adminError) {
        console.error(
          "[Password Change] Failed to add email identity:",
          adminError
        );
        return NextResponse.json(
          { error: "Failed to add email provider" },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      requiresRelogin = true;
    }

    // Update has_password flag
    const { error: flagError } = await supabaseAdmin
      .from("users")
      .update({ has_password: true })
      .eq("id", user.id);

    if (flagError) {
      console.error(
        "[Password Change] Failed to update has_password flag:",
        flagError
      );
      // Don't throw - password was updated successfully
    }

    // Log the password change event
    await logAccountEvent({
      user_id: user.id,
      event_type: "PASSWORD_CHANGED",
      device_session_id: deviceSessionId,
      metadata: {
        device: {
          device_name: parser.getDevice().model || "Unknown Device",
          browser: parser.getBrowser().name || null,
          os: parser.getOS().name || null,
          ip_address: getClientIp(request),
        },
        category: "warning",
        description: requiresRelogin
          ? "Added password to OAuth account"
          : "Account password was changed",
      },
    });

    // Send email alert for password change
    if (
      AUTH_CONFIG.emailAlerts.passwordChange.enabled &&
      AUTH_CONFIG.emailAlerts.passwordChange.alertOnChange
    ) {
      await sendEmailAlert({
        request,
        origin,
        user,
        title: requiresRelogin ? "Password Added" : "Your password was changed",
        message: requiresRelogin
          ? "A password was added to your account. You can now sign in using your email and password."
          : "Your account password was just changed. If this wasn't you, please secure your account immediately.",
        device: {
          user_id: user.id,
          device_name: parser.getDevice().model || "Unknown Device",
          browser: parser.getBrowser().name || null,
          os: parser.getOS().name || null,
          ip_address: getClientIp(request),
        },
      });
    }

    // Return appropriate response based on whether re-login is needed
    return NextResponse.json(
      requiresRelogin
        ? {
            requiresRelogin: true,
            email: user.email,
            message:
              "Password added successfully. Please log in again for security reasons.",
          }
        : {}
    );
  } catch (error) {
    console.error("[Password Change] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
