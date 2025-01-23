import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { apiRateLimit } from "@/utils/rate-limit";
import { twoFactorVerificationSchema } from "@/utils/validation/auth-validation";
import { verifyTwoFactorCode } from "@/utils/auth/two-factor";

export async function POST(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    const supabase = await createClient();

    // Check if user is authenticated
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

    const body = await request.json();
    const validation = twoFactorVerificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { factorId, code, newPassword } = validation.data;

    try {
      // Verify 2FA code
      await verifyTwoFactorCode(supabase, factorId, code);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to verify code",
        },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Update password after successful 2FA verification
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error completing password change:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
