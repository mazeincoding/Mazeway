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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { passwordChangeSchema } from "@/utils/validation/auth-validation";
import { TApiErrorResponse, TPasswordChangeResponse } from "@/types/api";
import { apiRateLimit } from "@/utils/rate-limit";
import { checkTwoFactorRequirements } from "@/utils/auth/two-factor";

export async function POST(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    const supabase = await createClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body = await request.json();

    // Validate password change data
    const result = passwordChangeSchema.safeParse(body);
    if (!result.success) {
      const error = result.error.issues[0]?.message || "Invalid input";
      return NextResponse.json(
        { error },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { currentPassword, newPassword } = result.data;

    // Check if user has password auth
    const hasPasswordAuth = user.app_metadata.providers?.includes("email");

    // If user has password auth, verify current password
    if (hasPasswordAuth) {
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

    // Check if 2FA is required
    try {
      const twoFactorResult = await checkTwoFactorRequirements(supabase);

      if (twoFactorResult.requiresTwoFactor) {
        return NextResponse.json({
          ...twoFactorResult,
          newPassword,
        }) satisfies NextResponse<TPasswordChangeResponse>;
      }
    } catch (error) {
      console.error("Error checking 2FA requirements:", error);
      return NextResponse.json(
        { error: "Failed to check 2FA status" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // If no 2FA required or not configured, update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({
      requiresTwoFactor: false,
    }) satisfies NextResponse<TPasswordChangeResponse>;
  } catch (error) {
    console.error("Error in change password:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
