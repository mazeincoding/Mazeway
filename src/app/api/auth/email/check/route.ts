import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { authSchema } from "@/utils/validation/auth-validation";
import {
  TApiErrorResponse,
  TCheckEmailRequest,
  TCheckEmailResponse,
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
    const validation = authSchema.shape.email.safeParse(rawBody.email);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TCheckEmailRequest = { email: validation.data };

    // Use service role to check user existence
    const adminClient = await createClient({ useServiceRole: true });

    // Query the users table directly
    const { data, error } = await adminClient
      .from("users")
      .select("id")
      .eq("email", body.email)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      return NextResponse.json(
        { error: "Failed to check email" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({
      exists: !!data,
    }) satisfies NextResponse<TCheckEmailResponse>;
  } catch (error) {
    console.error("Email check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
