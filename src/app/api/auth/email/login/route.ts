import { createClient } from "@/utils/supabase/server";
import { validateFormData } from "@/utils/validation/auth-validation";
import { NextResponse } from "next/server";
import { authRateLimit } from "@/utils/rate-limit";
import { TApiErrorResponse, TEmailLoginResponse } from "@/types/api";
import { checkTwoFactorRequirements } from "@/utils/auth/two-factor";

export async function POST(request: Request) {
  try {
    if (authRateLimit) {
      const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const { origin } = new URL(request.url);
    const redirectUrl = `${origin}/api/auth/complete?provider=email&next=/`;

    const body = await request.json();
    const validation = validateFormData(body);

    if (validation.error || !validation.data) {
      return NextResponse.json(
        { error: validation.error || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword(
      validation.data
    );

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    try {
      // Check if 2FA is required
      const twoFactorResult = await checkTwoFactorRequirements(supabase);

      if (twoFactorResult.requiresTwoFactor) {
        return NextResponse.json({
          ...twoFactorResult,
          redirectTo: redirectUrl,
        }) satisfies NextResponse<TEmailLoginResponse>;
      }
    } catch (error) {
      console.error("Error checking 2FA requirements:", error);
      return NextResponse.json(
        { error: "Failed to check 2FA status" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // If no 2FA required or not configured, proceed with login
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
