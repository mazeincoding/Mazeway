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
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  hasGracePeriodExpired,
  getUserVerificationMethods,
} from "@/utils/auth";
import { passwordChangeSchema } from "@/utils/validation/auth-validation";

export async function POST(request: NextRequest) {
  if (apiRateLimit) {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

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

  try {
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
    const deviceSessionId = request.cookies.get("device_session_id")?.value;
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

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
