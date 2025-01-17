import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { validateEmail } from "@/utils/validation/auth-validation";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const { origin } = new URL(request.url);

    // Validate email
    const validation = validateEmail(email);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || "Invalid email" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();

    // Send reset password email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
