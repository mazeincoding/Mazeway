import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TEnroll2FARequest,
  TEnroll2FAResponse,
} from "@/types/api";
import { authRateLimit, smsRateLimit, getClientIp } from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";
import { smsEnrollmentSchema } from "@/utils/validation/auth-validation";

export async function POST(request: NextRequest) {
  try {
    // Check if 2FA is enabled in config
    if (!AUTH_CONFIG.twoFactorAuth.enabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is not enabled" },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();

    // 1. Verify user authentication first
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

    // 2. Get and validate request body
    const body = (await request.json()) as TEnroll2FARequest;
    const method = body.method || "authenticator";
    const password = body.password;

    // Only verify password for users with password auth
    if (dbUser.has_password) {
      // Verify password is provided
      if (!password) {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      // Verify password is correct
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (signInError) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 3. Validate method configuration
    const methodConfig = AUTH_CONFIG.twoFactorAuth.methods.find(
      (m) => m.type === method
    );
    if (!methodConfig?.enabled) {
      return NextResponse.json(
        { error: `${method} method is not enabled` },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 4. Get client IP securely
    const clientIp = getClientIp(request);

    // 5. Apply rate limits in order of most specific to least specific
    if (method === "sms" && smsRateLimit) {
      // Check user-based rate limit first (most specific)
      const { success: userSuccess } = await smsRateLimit.user.limit(user.id);
      if (!userSuccess) {
        return NextResponse.json(
          {
            error:
              "Daily SMS limit reached for this account. Please try again tomorrow.",
          },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      // Then check IP-based rate limit
      const { success: ipSuccess } = await smsRateLimit.ip.limit(clientIp);
      if (!ipSuccess) {
        return NextResponse.json(
          {
            error:
              "Too many SMS requests from this IP. Please try again later.",
          },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 6. Apply general auth rate limit last (least specific)
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 7. Handle SMS enrollment with validated phone number
    if (method === "sms") {
      const validation = smsEnrollmentSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0]?.message || "Invalid input" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      const { data: factorData, error: factorError } =
        await supabase.auth.mfa.enroll({
          factorType: "phone",
          phone: validation.data.phone,
        });

      if (factorError) {
        console.error("Failed to enroll in SMS 2FA:", factorError);
        return NextResponse.json(
          { error: factorError.message },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      return NextResponse.json({
        factor_id: factorData.id,
        phone: factorData.phone,
      }) satisfies NextResponse<TEnroll2FAResponse>;
    }

    // 8. Handle authenticator enrollment

    // Check for existing unverified TOTP factors and remove them
    const { data: factors } = await supabase.auth.mfa.listFactors();
    if (factors?.all) {
      const unverifiedTotpFactors = factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );

      // Remove any unverified TOTP factors
      for (const factor of unverifiedTotpFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data: factorData, error: factorError } =
      await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

    if (factorError) {
      console.error("Failed to enroll in 2FA:", factorError);
      return NextResponse.json(
        { error: factorError.message },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({
      qr_code: factorData.totp.qr_code,
      secret: factorData.totp.secret,
      factor_id: factorData.id,
    }) satisfies NextResponse<TEnroll2FAResponse>;
  } catch (error) {
    console.error("Error in 2FA enrollment:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
