import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { TApiErrorResponse, TEmailLoginResponse } from "@/types/api";
import { checkTwoFactorRequirements } from "@/utils/auth";

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
    const redirectUrl = `${origin}/api/auth/post-auth?provider=email&next=/`;

    const body = await request.json();

    // Basic check for required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError) {
      // Generic error message for any auth failure
      return NextResponse.json(
        { error: "Invalid email or password" },
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
