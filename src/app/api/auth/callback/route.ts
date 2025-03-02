import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRecoveryToken } from "@/utils/auth/recovery-token";
import { AUTH_CONFIG } from "@/config/auth";
import { getUserVerificationMethods } from "@/utils/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=oauth_error&message=${encodeURIComponent(error.message)}`
      );
    }

    return NextResponse.redirect(
      `${origin}/api/auth/post-auth?provider=google&next=${next}&should_refresh=true`
    );
  }

  // For non-OAuth flows, verify required parameters
  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Missing parameters")}`
    );
  }

  // Handle password reset callback
  if (type === "recovery") {
    const { data: preCheck, error: preError } = await supabase.auth.getUser();

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent(error.message)}`
      );
    }

    const { data: postCheck, error: postError } = await supabase.auth.getUser();

    if (postError || !postCheck.user?.id) {
      const errorMessage = postError?.message || "Invalid user session";
      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent(errorMessage)}`
      );
    }

    // Check if user has 2FA enabled
    const { has2FA, factors } = await getUserVerificationMethods(supabase);
    const resetUrl = new URL(`${origin}/auth/reset-password`);

    if (has2FA) {
      // Add 2FA requirements to URL
      resetUrl.searchParams.set("requires_2fa", "true");
      resetUrl.searchParams.set("factor_id", factors[0].factorId);
      resetUrl.searchParams.set("available_methods", JSON.stringify(factors));
    }

    // Create response for reset password redirect
    const response = NextResponse.redirect(resetUrl);

    // Only do recovery token flow if relogin is required
    if (AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      // Create encrypted recovery token with user ID
      const recoveryToken = createRecoveryToken(postCheck.user.id);

      // Set secure HTTP-only recovery cookie with 15 minute expiry
      response.cookies.set("recovery_session", recoveryToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes
        path: "/",
      });

      // Call logout endpoint to clear Supabase session
      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      });
    }

    return response;
  }

  // Invalid type
  return NextResponse.redirect(
    `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Invalid callback request")}`
  );
}
