import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { AuthApiError } from "@supabase/supabase-js";
import { logAccountEvent } from "@/utils/account-events/server";
import { getDeviceSessionId } from "@/utils/auth";
import { UAParser } from "ua-parser-js";
import { getClientIp } from "@/utils/rate-limit";

export async function GET(request: NextRequest) {
  console.log("[AUTH] /api/auth/confirm - Request received", {
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const oldEmail = searchParams.get("old_email");

  console.log("[AUTH] /api/auth/confirm - Parameters", {
    hasTokenHash: !!token_hash,
    type,
    next,
    oldEmail,
  });

  if (!token_hash || !type) {
    console.error("[AUTH] /api/auth/confirm - Missing required parameters", {
      hasTokenHash: !!token_hash,
      type,
    });

    const actions = encodeURIComponent(
      JSON.stringify([{ label: "Go home", href: "/", type: "default" }])
    );
    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("Invalid link")}&message=${encodeURIComponent("The confirmation link is invalid or incomplete.")}&actions=${actions}&error=validation_failed`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    console.error("[AUTH] /api/auth/confirm - OTP verification failed", {
      error: error.message,
      code: error.status,
    });

    const actions = encodeURIComponent(
      JSON.stringify([
        { label: "Try again", href: "/auth/signup", type: "default" },
        { label: "Go home", href: "/", type: "secondary" },
      ])
    );

    const errorCode =
      error instanceof AuthApiError
        ? error.code || error.message
        : error.message;

    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("Verification failed")}&message=${encodeURIComponent("There was a problem verifying your email. Please try signing up again.")}&actions=${actions}&error=${errorCode}`
    );
  }

  console.log("[AUTH] /api/auth/confirm - OTP verification successful");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    console.error("[AUTH] /api/auth/confirm - Failed to get user", {
      error: userError?.message,
    });

    const actions = encodeURIComponent(
      JSON.stringify([
        { label: "Try again", href: "/auth/signup", type: "default" },
        { label: "Go home", href: "/", type: "secondary" },
      ])
    );

    const errorCode =
      userError instanceof AuthApiError
        ? userError.code || userError.message
        : userError?.message || "user_not_found";

    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("Verification failed")}&message=${encodeURIComponent("There was a problem with your account. Please try signing up again.")}&actions=${actions}&error=${errorCode}`
    );
  }

  // Log email change event if this was an email change verification
  if (type === "email_change") {
    const deviceSessionId = getDeviceSessionId(request);
    if (deviceSessionId) {
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
          oldEmail: oldEmail || "unknown",
          newEmail: user.email || "unknown",
          category: "warning",
          description: `Email address changed from ${oldEmail || "unknown"} to ${user.email || "unknown"} (verified)`,
        },
      });
    }
  }

  if (!user.email_confirmed_at) {
    console.error("[AUTH] /api/auth/confirm - Email not confirmed", {
      userId: user.id,
    });

    const actions = encodeURIComponent(
      JSON.stringify([
        { label: "Try again", href: "/auth/signup", type: "default" },
        { label: "Go home", href: "/", type: "secondary" },
      ])
    );
    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("Email not verified")}&message=${encodeURIComponent("Your email address is not verified. Please check your inbox and try again.")}&actions=${actions}&error=email_not_confirmed`
    );
  }

  console.log(
    "[AUTH] /api/auth/confirm - Email confirmed, redirecting to post-auth"
  );

  return NextResponse.redirect(
    `${origin}/api/auth/post-auth?next=${next}&should_refresh=true`
  );
}
