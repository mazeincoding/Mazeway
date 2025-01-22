import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { authRateLimit, smsRateLimit, getClientIp } from "@/utils/rate-limit";
import { disable2FASchema } from "@/utils/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";

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

    // 2. Get and validate request body
    const body = await request.json();
    const validation = disable2FASchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { factorId, code, password, method } = validation.data;

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
      // Check user-based rate limit first
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

    // 6. Apply general auth rate limit last
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 7. Verify password first
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

    // 8. Create challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      console.error("Failed to create 2FA challenge:", challengeError);
      return NextResponse.json(
        { error: challengeError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 9. Verify the code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      console.error(`Failed to verify ${method} code:`, verifyError);
      return NextResponse.json(
        { error: verifyError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 10. If both password and code are verified, unenroll the factor
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (unenrollError) {
      console.error("Failed to disable 2FA:", unenrollError);
      return NextResponse.json(
        { error: unenrollError.message },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error in 2FA disable:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
