/**
 * This route is for non-authenticated users.
 * It doesn't reset the password, it just sends an email to the user with a link to change their password.
 * The implementation of the password change is in /api/auth/reset-password.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/utils/validation/auth-validation";
import {
  TApiErrorResponse,
  TEmptySuccessResponse,
  TForgotPasswordRequest,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const { origin } = new URL(request.url);

    // Get and validate request body
    const rawBody = await request.json();
    const validation = authSchema.shape.email.safeParse(rawBody.email);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TForgotPasswordRequest = { email: validation.data };

    const supabase = await createClient();

    // Send reset password email
    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: `${origin}/auth/reset-password`,
    });

    if (error) {
      // Don't expose this error
      console.error("Failed to send reset password email:", error);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      {},
      { status: 200 }
    ) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error in forgot password:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
