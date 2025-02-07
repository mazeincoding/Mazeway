import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { disable2FASchema } from "@/utils/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { isOAuthOnlyUser } from "@/utils/auth";

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

    const { password, code, factorId } = validation.data;

    // 3. Get client IP securely
    const clientIp = getClientIp(request);

    // 4. Apply rate limits
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 5. Check if user is OAuth-only
    const providers = user.app_metadata.providers || [];
    const isOAuthUser = isOAuthOnlyUser(providers);

    // 6. Verify password only for non-OAuth users
    if (!isOAuthUser) {
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

    // 7. Create challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      console.error("Failed to create 2FA challenge:", challengeError);
      return NextResponse.json(
        { error: challengeError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 8. Verify the code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      console.error("Failed to verify code:", verifyError);
      return NextResponse.json(
        { error: verifyError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 9. Handle disabling based on type
    if (validation.data.type === "all") {
      // Get all enrolled factors
      const { data: factors } = await supabase.auth.mfa.listFactors();

      // Unenroll all verified factors
      const unenrollPromises = factors?.all
        ?.filter((factor) => factor.status === "verified")
        .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id }));

      if (unenrollPromises?.length) {
        const results = await Promise.all(unenrollPromises);
        const errors = results.filter((r) => r.error).map((r) => r.error);

        if (errors.length) {
          console.error("Failed to disable all 2FA factors:", errors);
          return NextResponse.json(
            { error: "Failed to disable all 2FA factors" },
            { status: 500 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }
      }
    } else {
      // Disable specific method
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) {
        console.error("Failed to disable 2FA method:", unenrollError);
        return NextResponse.json(
          { error: unenrollError.message },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
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
