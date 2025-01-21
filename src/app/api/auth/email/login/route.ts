import { createClient } from "@/utils/supabase/server";
import { validateFormData } from "@/utils/validation/auth-validation";
import { NextResponse } from "next/server";
import { authRateLimit } from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";
import { TApiErrorResponse, TEmailLoginResponse } from "@/types/api";

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

    // Check if 2FA is enabled in config
    if (AUTH_CONFIG.twoFactorAuth.enabled) {
      // Check if authenticator method is enabled
      const authenticatorConfig = AUTH_CONFIG.twoFactorAuth.methods.find(
        (m) => m.type === "authenticator"
      );

      if (authenticatorConfig?.enabled) {
        // Get user's enrolled factors
        const { data, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError || !data?.totp) {
          console.error("Error getting MFA factors:", factorsError);
          return NextResponse.json(
            { error: "Failed to check 2FA status" },
            { status: 500 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // If user has verified TOTP factors, require 2FA
        const hasVerifiedTOTP = data.totp.some(
          (factor) => factor.status === "verified"
        );
        if (hasVerifiedTOTP) {
          return NextResponse.json({
            requiresTwoFactor: true,
            factorId: data.totp[0].id,
            redirectTo: redirectUrl,
          }) satisfies NextResponse<TEmailLoginResponse>;
        }
      }
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
