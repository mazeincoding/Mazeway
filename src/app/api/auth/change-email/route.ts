import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TChangeEmailResponse } from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
  getDeviceSessionId,
} from "@/utils/auth";
import { emailChangeSchema } from "@/utils/validation/auth-validation";
import { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";

async function updateUserEmail(supabase: SupabaseClient, newEmail: string) {
  // Update email in auth - this will trigger Supabase to send verification email
  // We're not updating the user profile in the DB because the user needs to verify the new email first
  const { error: updateError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (updateError) throw updateError;
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

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
    const deviceSessionId = getDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed
    try {
      const gracePeriodExpired = await hasGracePeriodExpired(
        supabase,
        deviceSessionId
      );
      const { has2FA, factors } = await getUserVerificationMethods(supabase);

      if (gracePeriodExpired && has2FA) {
        // Send alert for email change initiation if enabled
        if (
          AUTH_CONFIG.emailAlerts.email.enabled &&
          AUTH_CONFIG.emailAlerts.email.alertOnInitiate
        ) {
          await sendEmailAlert({
            request,
            origin,
            user,
            title: "Email change requested",
            message:
              "Someone has requested to change your account's email address. If this wasn't you, please secure your account immediately.",
            oldEmail: user.email,
            newEmail,
          });
        }

        return NextResponse.json({
          requiresTwoFactor: true,
          factorId: factors[0].factorId,
          availableMethods: factors,
          newEmail,
        }) satisfies NextResponse<TChangeEmailResponse>;
      }

      // If no 2FA required or within grace period, update email directly
      await updateUserEmail(supabase, newEmail);

      // Send alert for completed email change if enabled
      if (
        AUTH_CONFIG.emailAlerts.email.enabled &&
        AUTH_CONFIG.emailAlerts.email.alertOnComplete
      ) {
        // Send to old email
        await sendEmailAlert({
          request,
          origin,
          user,
          title: "Your email address was changed",
          message:
            "Your account's email address has been changed. If this wasn't you, please contact support immediately.",
          oldEmail: user.email,
          newEmail,
        });

        // Send to new email
        await sendEmailAlert({
          request,
          origin,
          user: { ...user, email: newEmail },
          title: "Email address change confirmed",
          message:
            "Your account's email address has been changed to this address. If this wasn't you, please contact support immediately.",
          oldEmail: user.email,
          newEmail,
        });
      }

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
