import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEnroll2FAResponse } from "@/types/api";
import { authRateLimit } from "@/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
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

    const supabase = await createClient();

    // Verify user is authenticated
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

    // Start MFA enrollment
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

    // Return the QR code and secret
    return NextResponse.json({
      qr_code: factorData.totp.qr_code,
      secret: factorData.totp.secret,
    }) satisfies NextResponse<TEnroll2FAResponse>;
  } catch (error) {
    console.error("Error in 2FA enrollment:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
