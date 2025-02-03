/**
 * This route is for users with recovery sessions (from password reset email)
 * to set a new password. It requires only the new password, unlike the
 * change-password route which requires both current and new password.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { validatePassword } from "@/utils/validation/auth-validation";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Verify recovery cookie is present
    const hasRecoveryCookie = request.cookies.has("recovery_session");
    if (!hasRecoveryCookie) {
      return NextResponse.json(
        { error: "Invalid password reset session" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
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

    const { password } = await request.json();

    // Validate new password
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || "Invalid password" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error("Failed to reset password:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to reset password" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Create success response
    const response = NextResponse.json(
      {},
      { status: 200 }
    ) satisfies NextResponse<TEmptySuccessResponse>;

    // Clear recovery cookie
    response.cookies.set("recovery_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in reset password:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
