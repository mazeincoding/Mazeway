import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRecoveryToken } from "@/utils/auth/recovery-token";
import { AUTH_CONFIG } from "@/config/auth";
import { getUserVerificationMethods, getUser } from "@/utils/auth";
import { AuthApiError } from "@supabase/supabase-js";

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
      const actions = encodeURIComponent(
        JSON.stringify([
          { label: "Log in with email", href: "/auth/login", type: "default" },
          { label: "Go home", href: "/", type: "secondary" },
        ])
      );
      return NextResponse.redirect(
        `${origin}/auth/error?title=${encodeURIComponent("Google sign-in unavailable")}&message=${encodeURIComponent("Google authentication is currently disabled on this site.")}&actions=${actions}&error=provider_disabled`
      );
    }
    if (provider === "github" && !AUTH_CONFIG.socialProviders.github.enabled) {
      console.error("[AUTH] /api/auth/callback - GitHub auth is disabled");
      const actions = encodeURIComponent(
        JSON.stringify([
          { label: "Log in with email", href: "/auth/login", type: "default" },
          { label: "Go home", href: "/", type: "secondary" },
        ])
      );
      return NextResponse.redirect(
        `${origin}/auth/error?title=${encodeURIComponent("GitHub sign-in unavailable")}&message=${encodeURIComponent("GitHub authentication is currently disabled on this site.")}&actions=${actions}&error=provider_disabled`
      );
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[AUTH] /api/auth/callback - OAuth code exchange failed", {
        error: error.message,
        code: error.status,
      });

      const actions = encodeURIComponent(
        JSON.stringify([
          { label: "Try again", href: "/auth/login", type: "default" },
        ])
      );

      // If it's a Supabase auth error, use its code
      const errorCode =
        error instanceof AuthApiError
          ? error.code || error.message
          : error.message;

      return NextResponse.redirect(
        `${origin}/auth/error?title=${encodeURIComponent("Authentication failed")}&message=${encodeURIComponent("There was a problem signing in. Please try again or contact support.")}&actions=${actions}&error=${errorCode}`
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

    const actions = encodeURIComponent(
      JSON.stringify([{ label: "Go home", href: "/", type: "default" }])
    );
    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("Invalid link")}&message=${encodeURIComponent("The authentication link is invalid or incomplete.")}&actions=${actions}&error=validation_failed`
    );
  }

  // Handle password reset callback
  if (type === "recovery") {
    console.log("[AUTH] /api/auth/callback - Processing recovery flow");

    // Verify the password reset token
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      console.error("[AUTH] /api/auth/callback - OTP verification failed", {
        error: error.message,
        code: error.status,
      });

      const actions = encodeURIComponent(
        JSON.stringify([
          {
            label: "Try again",
            href: "/auth/forgot-password",
            type: "default",
          },
          { label: "Go home", href: "/", type: "secondary" },
        ])
      );

      // If it's a Supabase auth error, use its code
      const errorCode =
        error instanceof AuthApiError
          ? error.code || error.message
          : error.message;

      return NextResponse.redirect(
        `${origin}/auth/error?title=${encodeURIComponent("Password reset failed")}&message=${encodeURIComponent("There was a problem resetting your password. Please try again.")}&actions=${actions}&error=${errorCode}`
      );
    }

    console.log("[AUTH] /api/auth/callback - OTP verification successful");

    // Get user data after successful verification
    const { user, error: userError } = await getUser(supabase);
    if (userError || !user) {
      const errorMessage = userError || "Invalid user session";
      console.error("[AUTH] /api/auth/callback - Failed to get user data", {
        error: errorMessage,
      });

      const actions = encodeURIComponent(
        JSON.stringify([
          {
            label: "Try again",
            href: "/auth/forgot-password",
            type: "default",
          },
          { label: "Go home", href: "/", type: "secondary" },
        ])
      );

      return NextResponse.redirect(
        `${origin}/auth/error?title=${encodeURIComponent("Password reset failed")}&message=${encodeURIComponent("There was a problem with your session. Please try again.")}&actions=${actions}&error=${errorMessage}`
      );
    }

    console.log("[AUTH] /api/auth/callback - Got user data", {
      userId: user.id,
      email: user.email,
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
      const recoveryToken = createRecoveryToken(user.id);

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

  const actions = encodeURIComponent(
    JSON.stringify([
      { label: "Log in", href: "/auth/login", type: "default" },
      { label: "Go home", href: "/", type: "secondary" },
    ])
  );
  return NextResponse.redirect(
    `${origin}/auth/error?title=${encodeURIComponent("Invalid request")}&message=${encodeURIComponent("The authentication request was invalid. Please try logging in again.")}&actions=${actions}&error=validation_failed`
  );
}
