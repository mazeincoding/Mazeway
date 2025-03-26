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
import { emailChangeSchema } from "@/validation/auth-validation";
import { SupabaseClient, AuthError } from "@supabase/supabase-js";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { UAParser } from "ua-parser-js";

async function updateUserEmail(supabase: SupabaseClient, newEmail: string) {
  // Update email in auth
  const { data, error: updateError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (updateError) throw updateError;

  // If data.user exists and email is updated, it means Supabase didn't require email ownership verification
  // If data.user exists but email is not updated, it means Supabase sent a verification link
  return {
    needsEmailConfirmation: !data.user || data.user.email !== newEmail,
    user: data.user,
  };
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
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { user, error } = await getUser({ supabase });
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
      const gracePeriodExpired = await hasGracePeriodExpired({
        deviceSessionId,
        supabase,
      });
      const { has2FA, factors } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

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

      // Log sensitive action verification
      const parser = new UAParser(request.headers.get("user-agent") || "");
      await logAccountEvent({
        user_id: user.id,
        event_type: "SENSITIVE_ACTION_VERIFIED",
        device_session_id: deviceSessionId,
        metadata: {
          device: {
            device_name: parser.getDevice().model || "Unknown Device",
            browser: parser.getBrowser().name || null,
            os: parser.getOS().name || null,
            ip_address: getClientIp(request),
          },
          action: "change_email",
          category: "info",
          description: "Email change request verified",
        },
      });

      // If no 2FA required or within grace period, update email directly
      const { needsEmailConfirmation } = await updateUserEmail(
        supabase,
        newEmail
      );

      if (!needsEmailConfirmation) {
        // Email was changed immediately, log the event
        const parser = new UAParser(request.headers.get("user-agent") || "");
        await logAccountEvent({
          user_id: user.id,
          event_type: "EMAIL_CHANGED",
          device_session_id: deviceSessionId,
          metadata: {
            device: {
              device_name: parser.getDevice().model || "Unknown Device",
              browser: parser.getBrowser().name || null,
              os: parser.getOS().name || null,
              ip_address: getClientIp(request),
            },
            oldEmail: user.email,
            newEmail,
            category: "warning",
            description: `Email address changed from ${user.email} to ${newEmail}`,
          },
        });

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
          message: "Email changed successfully",
        });
      }

      // If we get here, verification is required
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
        message: "Please check your new email for verification",
      });
    } catch (error) {
      console.error("Error in email change flow:", error);

      // Handle Supabase Auth API errors
      if (error instanceof AuthError) {
        // Handle specific error cases
        if (error.code === "email_exists") {
          return NextResponse.json(
            { error: "This email address is already in use" },
            { status: 422 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Handle rate limiting
        if (error.status === 429) {
          return NextResponse.json(
            { error: "Too many attempts. Please try again later." },
            { status: 429 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // For other auth errors, return the actual error message
        return NextResponse.json(
          { error: error.message || "Authentication error" },
          { status: error.status || 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      // For unknown errors, keep the generic message but log the full error
      return NextResponse.json(
        { error: "Failed to process email change" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  } catch (error) {
    console.error("Error changing email:", error);

    // Handle outer try-catch the same way for consistency
    if (error instanceof AuthError) {
      if (error.code === "email_exists") {
        return NextResponse.json(
          { error: "This email address is already in use" },
          { status: 422 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      if (error.status === 429) {
        return NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      return NextResponse.json(
        { error: error.message || "Authentication error" },
        { status: error.status || 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
