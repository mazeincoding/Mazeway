import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRecoveryToken } from "@/utils/auth/recovery-token";
import { AUTH_CONFIG } from "@/config/auth";
import { getUserVerificationMethods } from "@/utils/auth";

export async function GET(request: Request) {
  console.log("[AUTH] /api/auth/callback - Request received", {
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const provider = searchParams.get("provider") || "browser";

  console.log("[AUTH] /api/auth/callback - Parameters", {
    hasCode: !!code,
    next,
    hasTokenHash: !!token_hash,
    type,
    provider,
  });

  const supabase = await createClient();

  if (code) {
    console.log("[AUTH] /api/auth/callback - Processing OAuth code exchange");

    // Check if the provider is enabled before processing OAuth code exchange
    if (provider === "google" && !AUTH_CONFIG.socialProviders.google.enabled) {
      console.error("[AUTH] /api/auth/callback - Google auth is disabled");
      return NextResponse.redirect(
        `${origin}/auth/error?error=google_auth_disabled&message=${encodeURIComponent("Google authentication is disabled")}`
      );
    }
    if (provider === "github" && !AUTH_CONFIG.socialProviders.github.enabled) {
      console.error("[AUTH] /api/auth/callback - GitHub auth is disabled");
      return NextResponse.redirect(
        `${origin}/auth/error?error=github_auth_disabled&message=${encodeURIComponent("GitHub authentication is disabled")}`
      );
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[AUTH] /api/auth/callback - OAuth code exchange failed", {
        error: error.message,
        code: error.status,
      });

      return NextResponse.redirect(
        `${origin}/auth/error?error=oauth_error&message=${encodeURIComponent(error.message)}`
      );
    }

    console.log(
      "[AUTH] /api/auth/callback - OAuth code exchange successful, redirecting to post-auth"
    );

    return NextResponse.redirect(
      `${origin}/api/auth/post-auth?provider=${provider}&next=${next}&should_refresh=true`
    );
  }

  // For non-OAuth flows, verify required parameters
  if (!token_hash || !type) {
    console.error("[AUTH] /api/auth/callback - Missing required parameters", {
      hasTokenHash: !!token_hash,
      type,
    });

    return NextResponse.redirect(
      `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Missing parameters")}`
    );
  }

  // Handle password reset callback
  if (type === "recovery") {
    console.log("[AUTH] /api/auth/callback - Processing recovery flow");

    const { data: preCheck, error: preError } = await supabase.auth.getUser();
    if (preError) {
      console.error("[AUTH] /api/auth/callback - Pre-check user error", {
        error: preError.message,
      });
    } else {
      console.log("[AUTH] /api/auth/callback - Pre-check user status", {
        userExists: !!preCheck?.user,
        userId: preCheck?.user?.id,
      });
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      console.error("[AUTH] /api/auth/callback - OTP verification failed", {
        error: error.message,
        code: error.status,
      });

      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent(error.message)}`
      );
    }

    console.log("[AUTH] /api/auth/callback - OTP verification successful");

    const { data: postCheck, error: postError } = await supabase.auth.getUser();

    if (postError || !postCheck.user?.id) {
      const errorMessage = postError?.message || "Invalid user session";
      console.error("[AUTH] /api/auth/callback - Post-check user error", {
        error: errorMessage,
      });

      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent(errorMessage)}`
      );
    }

    console.log("[AUTH] /api/auth/callback - Post-check user status", {
      userId: postCheck.user.id,
      email: postCheck.user.email,
    });

    // Check if user has 2FA enabled
    const { has2FA, factors } = await getUserVerificationMethods(supabase);
    console.log("[AUTH] /api/auth/callback - User verification methods", {
      has2FA,
      factorCount: factors.length,
    });

    const resetUrl = new URL(`${origin}/auth/reset-password`);

    if (has2FA) {
      // Add 2FA requirements to URL
      resetUrl.searchParams.set("requires_2fa", "true");
      resetUrl.searchParams.set("factor_id", factors[0].factorId);
      resetUrl.searchParams.set("available_methods", JSON.stringify(factors));
      console.log("[AUTH] /api/auth/callback - Adding 2FA params to reset URL");
    }

    // Create response for reset password redirect
    const response = NextResponse.redirect(resetUrl);

    // Only do recovery token flow if relogin is required
    if (AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
      console.log(
        "[AUTH] /api/auth/callback - Setting up recovery token for password reset"
      );

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
      console.log(
        "[AUTH] /api/auth/callback - Calling logout endpoint to clear session"
      );

      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      });
    }

    console.log(
      "[AUTH] /api/auth/callback - Recovery flow completed, redirecting to reset password"
    );
    return response;
  }

  // Invalid type
  console.error("[AUTH] /api/auth/callback - Invalid callback type", { type });

  return NextResponse.redirect(
    `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Invalid callback request")}`
  );
}
