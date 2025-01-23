import { createClient } from "@/utils/supabase/server";
import { validateFormData } from "@/utils/validation/auth-validation";
import { NextResponse } from "next/server";
import { authRateLimit } from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";
import { TApiErrorResponse, TEmailLoginResponse } from "@/types/api";
import { TTwoFactorMethod } from "@/types/auth";

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
      // Get all enabled 2FA methods from config
      const enabledMethods = AUTH_CONFIG.twoFactorAuth.methods.filter(
        (m) => m.enabled
      );

      if (enabledMethods.length > 0) {
        // Get user's enrolled factors
        const { data, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) {
          console.error("Error getting MFA factors:", factorsError);
          return NextResponse.json(
            { error: "Failed to check 2FA status" },
            { status: 500 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        const availableMethods: Array<{
          type: TTwoFactorMethod;
          factorId: string;
        }> = [];

        // Check for verified TOTP factors
        if (data?.totp) {
          const verifiedTOTP = data.totp.filter(
            (factor) => factor.status === "verified"
          );

          if (verifiedTOTP.length > 0) {
            availableMethods.push({
              type: "authenticator",
              factorId: verifiedTOTP[0].id,
            });
          }
        }

        // Check for verified SMS factors
        if (data?.phone) {
          const verifiedSMS = data.phone.filter(
            (factor) => factor.status === "verified"
          );

          if (verifiedSMS.length > 0) {
            availableMethods.push({
              type: "sms",
              factorId: verifiedSMS[0].id,
            });
          }
        }

        // If user has any verified factors, require 2FA
        if (availableMethods.length > 0) {
          // Default to authenticator if available, otherwise first available method
          const defaultMethod =
            availableMethods.find((m) => m.type === "authenticator") ||
            availableMethods[0];

          return NextResponse.json({
            requiresTwoFactor: true,
            factorId: defaultMethod.factorId,
            availableMethods,
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
