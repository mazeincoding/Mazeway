import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/utils/validation/auth-validation";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  TApiErrorResponse,
  TEmailSignupRequest,
  TEmptySuccessResponse,
} from "@/types/api";

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

    const rawBody = await request.json();
    const validation = authSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TEmailSignupRequest = validation.data;

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
    });

    if (authError) {
      if (authError.code === "user_already_exists") {
        return NextResponse.json(
          {
            error:
              "This email is already in use. Please try logging in instead.",
          },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json(
      {},
      { status: 200 }
    ) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
