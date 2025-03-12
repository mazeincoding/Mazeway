import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TDisable2FARequest,
  TEmptySuccessResponse,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { disable2FASchema } from "@/utils/validation/auth-validation";
import { getFactorForMethod, getUser } from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = getClientIp(request);
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();
    const { user, error } = await getUser(supabase);
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 2. Get and validate request body
    const rawBody = await request.json();
    const validation = disable2FASchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TDisable2FARequest = validation.data;
    const { method, code } = body;

    // 3. Get factor ID for the method
    const factor = await getFactorForMethod(supabase, method);
    if (!factor.success || !factor.factorId) {
      return NextResponse.json(
        { error: factor.error || "2FA method not found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 4. Create challenge and verify code
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.factorId });

    if (challengeError) {
      console.error("Failed to create 2FA challenge:", challengeError);
      return NextResponse.json(
        { error: challengeError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.factorId,
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

    // 5. Disable the method
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.factorId,
    });

    if (unenrollError) {
      console.error("Failed to disable 2FA method:", unenrollError);
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
