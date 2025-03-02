import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TEnroll2FARequest,
  TEnroll2FAResponse,
} from "@/types/api";
import { authRateLimit, smsRateLimit, getClientIp } from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";
import { twoFactorEnrollmentSchema } from "@/utils/validation/auth-validation";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = await createClient({ useServiceRole: true });

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

    // 2. Get and validate request body
    const rawBody = await request.json();
    const validation = twoFactorEnrollmentSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TEnroll2FARequest = validation.data;

    // 3. Validate method configuration
    const methodConfig =
      AUTH_CONFIG.verificationMethods.twoFactor[
        body.method as keyof typeof AUTH_CONFIG.verificationMethods.twoFactor
      ];
    if (!methodConfig?.enabled) {
      return NextResponse.json(
        { error: `${body.method} method is not enabled` },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 4. Get client IP securely
    const clientIp = getClientIp(request);

    // 5. Apply rate limits in order of most specific to least specific
    if (body.method === "sms" && smsRateLimit) {
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
    if (body.method === "sms") {
      // Type narrowing - we know phone exists when method is "sms"
      const { phone } = body as { phone: string };
      const { data: factorData, error: factorError } =
        await supabase.auth.mfa.enroll({
          factorType: "phone",
          phone,
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
    const { data: factors } = await supabase.auth.mfa.listFactors();

    // Check for existing unverified TOTP factors and remove them
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
