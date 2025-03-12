import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TChangeEmailRequest,
  TChangeEmailResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
} from "@/utils/auth";
import { emailChangeSchema } from "@/utils/validation/auth-validation";
import { SupabaseClient } from "@supabase/supabase-js";

async function updateUserEmail(supabase: SupabaseClient, newEmail: string) {
  // Update email in auth - this will trigger Supabase to send verification email
  // We're not updating the user profile in the DB because the user needs to verify the new email first
  const { error: updateError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (updateError) throw updateError;
}

export async function POST(request: NextRequest) {
  try {
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
          },
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
    const validation = emailChangeSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { newEmail } = validation.data;

    // Get user data including has_password
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("has_password")
      .eq("id", user.id)
      .single();

    if (dbError || !dbUser) {
      return NextResponse.json(
        { error: "Failed to get user data" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // OAuth only users should change email through their provider
    if (!dbUser.has_password) {
      return NextResponse.json(
        { error: "Please change your email through your OAuth provider" },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if email is actually different
    if (newEmail === user.email) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get device session ID from cookie
    const deviceSessionId = request.cookies.get("device_session_id");
    if (!deviceSessionId?.value) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed
    try {
      const gracePeriodExpired = await hasGracePeriodExpired(
        supabase,
        deviceSessionId.value
      );
      const { has2FA, factors } = await getUserVerificationMethods(supabase);

      if (gracePeriodExpired && has2FA) {
        return NextResponse.json({
          requiresTwoFactor: true,
          factorId: factors[0].factorId,
          availableMethods: factors,
          newEmail,
        }) satisfies NextResponse<TChangeEmailResponse>;
      }

      // If no 2FA required or within grace period, update email directly
      await updateUserEmail(supabase, newEmail);
      return NextResponse.json({
        message: "Please check your new email for verification",
      });
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
