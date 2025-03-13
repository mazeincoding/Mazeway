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
  TEmptySuccessResponse,
  TPasswordChangeResponse,
  TSendEmailAlertRequest,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  hasGracePeriodExpired,
  getUserVerificationMethods,
  getUser,
  getDeviceSessionId,
} from "@/utils/auth";
import { passwordChangeSchema } from "@/utils/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { UAParser } from "ua-parser-js";

async function sendEmailAlert(
  request: NextRequest,
  origin: string,
  user: { id: string; email: string },
  title: string,
  message: string
) {
  try {
    const parser = new UAParser(request.headers.get("user-agent") || "");
    const deviceName = parser.getDevice().model || "Unknown Device";
    const browser = parser.getBrowser().name || "Unknown Browser";
    const os = parser.getOS().name || "Unknown OS";

    const body: TSendEmailAlertRequest = {
      email: user.email,
      title,
      message,
      device: {
        user_id: user.id,
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
      console.error("Failed to send password change alert", {
        status: emailAlertResponse.status,
        statusText: emailAlertResponse.statusText,
      });
    }
  } catch (error) {
    console.error("Error sending password change alert:", error);
    // Don't throw - password was updated successfully
  }
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    // Rate limiting
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
          },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();

    const { user, error } = await getUser(supabase);
    if (error || !user) {
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
      return NextResponse.json(
        { error: "Failed to get user data" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body = await request.json();

    // If not a 2FA request, validate password change data
    const validation = passwordChangeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { currentPassword, newPassword } = validation.data;

    // For users with password auth, verify current password
    if (dbUser.has_password) {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Get device session ID from cookie
    const deviceSessionId = getDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed
    const gracePeriodExpired = await hasGracePeriodExpired(
      supabase,
      deviceSessionId
    );
    if (gracePeriodExpired) {
      // Check if user has 2FA enabled
      const { has2FA, factors } = await getUserVerificationMethods(supabase);
      if (has2FA) {
        return NextResponse.json({
          requiresTwoFactor: true,
          factorId: factors[0].factorId,
          availableMethods: factors,
          newPassword,
        }) satisfies NextResponse<TPasswordChangeResponse>;
      }
    }

    // If no 2FA required or within grace period, update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      // Special handling for OAuth users
      if (
        dbUser.has_password &&
        updateError.message.includes("identity_not_found")
      ) {
        return NextResponse.json(
          { error: "Cannot add password. Please contact support." },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
      throw updateError;
    }

    // Update has_password flag
    const { error: flagError } = await supabase
      .from("users")
      .update({ has_password: true })
      .eq("id", user.id);

    if (flagError) {
      console.error("Failed to update has_password flag:", flagError);
      // Don't throw - password was updated successfully
    }

    // Send email alert for password change
    if (
      AUTH_CONFIG.emailAlerts.password.enabled &&
      AUTH_CONFIG.emailAlerts.password.alertOnChange
    ) {
      await sendEmailAlert(
        request,
        origin,
        user,
        "Your password was changed",
        "Your account password was just changed. If this wasn't you, please secure your account immediately."
      );
    }

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
