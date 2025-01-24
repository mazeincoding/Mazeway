import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TChangeEmailResponse,
  TEmptySuccessResponse,
} from "@/types/api";
import { apiRateLimit } from "@/utils/rate-limit";
import {
  checkTwoFactorRequirements,
  verifyTwoFactorCode,
} from "@/utils/two-factor";
import {
  emailChangeSchema,
  twoFactorVerificationSchema,
} from "@/utils/validation/auth-validation";
import { SupabaseClient } from "@supabase/supabase-js";

async function updateUserEmail(
  supabase: SupabaseClient,
  userId: string,
  newEmail: string
) {
  // Update email in auth
  const { error: updateError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (updateError) throw updateError;

  // Update user profile in database
  const { error: profileError } = await supabase
    .from("users")
    .update({ email: newEmail })
    .eq("id", userId);

  if (profileError) throw profileError;
}

export async function POST(request: NextRequest) {
  if (apiRateLimit) {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }
  }

  const supabase = await createClient();

  try {
    // Verify user authentication
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

    // Handle 2FA verification request
    const twoFactorValidation = twoFactorVerificationSchema.safeParse(body);
    if (twoFactorValidation.success) {
      const { factorId, code } = twoFactorValidation.data;
      const { newEmail } = body;

      if (!newEmail) {
        return NextResponse.json(
          { error: "New email is required" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      try {
        await verifyTwoFactorCode(supabase, factorId, code);
        await updateUserEmail(supabase, user.id, newEmail);
        return NextResponse.json(
          {}
        ) satisfies NextResponse<TEmptySuccessResponse>;
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to verify code",
          },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Handle initial email change request
    const validation = emailChangeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { newEmail } = validation.data;

    // Check if email is actually different
    if (newEmail === user.email) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if 2FA is required
    try {
      const twoFactorResult = await checkTwoFactorRequirements(supabase);

      if (twoFactorResult.requiresTwoFactor) {
        return NextResponse.json({
          ...twoFactorResult,
          newEmail,
        }) satisfies NextResponse<TChangeEmailResponse>;
      }

      // If no 2FA required, update email directly
      await updateUserEmail(supabase, user.id, newEmail);
      return NextResponse.json(
        {}
      ) satisfies NextResponse<TEmptySuccessResponse>;
    } catch (error) {
      console.error("Error in email change flow:", error);
      return NextResponse.json(
        { error: "Failed to process email change" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  } catch (error) {
    console.error("Error changing email:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
