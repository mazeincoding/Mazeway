import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/validation/auth-validation";
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

    // Check if email exists in our database using service role to bypass RLS
    const adminClient = await createClient({ useServiceRole: true });
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("email", body.email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          error: "This email is already in use. Please try logging in instead.",
        },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();
    const { data: signupData, error: authError } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
    });

    // Double-check Supabase's auth system for existing users
    if (authError) {
      console.error("Signup error:", authError);
      if (authError.code === "user_already_exists") {
        return NextResponse.json(
          {
            error:
              "This email is already registered. Please try logging in instead.",
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
    console.error("Error in signup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
