import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRecoveryToken } from "@/utils/auth/recovery-token";
import { AUTH_CONFIG } from "@/config/auth";
import { getUserVerificationMethods, getUser } from "@/utils/auth";
import { AuthApiError } from "@supabase/supabase-js";
import { createDeviceSession } from "@/utils/auth/device-sessions/server";
import { UAParser } from "ua-parser-js";

type TCallbackType = "recovery" | "email_change";

export async function GET(request: Request) {
  console.log("[AUTH] Callback request received", {
    url: request.url,
  });

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as TCallbackType | null;
  const provider = searchParams.get("provider");

  console.log("[AUTH] Callback parameters", {
    provider,
    next,
  });

  try {
    // Validate provider is one we actually support and is required
    if (!provider) {
      console.error("No provider specified");
      throw new Error("Provider is required");
    }

    const isValidProvider =
      provider === "google" || provider === "github" || provider === "email";
    if (!isValidProvider) {
      console.error("Invalid provider", {
        provider,
      });
      throw new Error("Invalid provider");
    }

    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    if (code) {
      console.log("[AUTH] Processing OAuth code exchange");

      // Check if the provider is enabled before processing OAuth code exchange
      if (
        provider === "google" &&
        !AUTH_CONFIG.socialProviders.google.enabled
      ) {
        console.error("[AUTH] Google auth is disabled");
        const actions = encodeURIComponent(
          JSON.stringify([
            {
              label: "Log in with email",
              href: "/auth/login",
              type: "default",
            },
            { label: "Go home", href: "/", type: "secondary" },
          ])
        );
        return NextResponse.redirect(
          `${origin}/auth/error?title=${encodeURIComponent("Google sign-in unavailable")}&message=${encodeURIComponent("Google authentication is currently disabled on this site.")}&actions=${actions}&error=provider_disabled`
        );
      }
      if (
        provider === "github" &&
        !AUTH_CONFIG.socialProviders.github.enabled
      ) {
        console.error("[AUTH] GitHub auth is disabled");
        const actions = encodeURIComponent(
          JSON.stringify([
            {
              label: "Log in with email",
              href: "/auth/login",
              type: "default",
            },
            { label: "Go home", href: "/", type: "secondary" },
          ])
        );
        return NextResponse.redirect(
          `${origin}/auth/error?title=${encodeURIComponent("GitHub sign-in unavailable")}&message=${encodeURIComponent("GitHub authentication is currently disabled on this site.")}&actions=${actions}&error=provider_disabled`
        );
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AUTH] OAuth code exchange failed", {
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

      console.log("[AUTH] OAuth code exchange successful");

      // Preserve the is_provider_connection flag from the original request
      const isProviderConnection = searchParams.get("is_provider_connection");
      const postAuthUrl = new URL(`${origin}/api/auth/post-auth`);
      postAuthUrl.searchParams.set("provider", provider);
      postAuthUrl.searchParams.set("next", next);
      postAuthUrl.searchParams.set("should_refresh", "true");
      if (isProviderConnection) {
        postAuthUrl.searchParams.set(
          "is_provider_connection",
          isProviderConnection
        );
      }

      return NextResponse.redirect(postAuthUrl.toString());
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

    // Validate type is one we support
    if (type !== "recovery" && type !== "email_change") {
      console.error("[AUTH] /api/auth/callback - Invalid callback type", {
        type,
      });

      const actions = encodeURIComponent(
        JSON.stringify([{ label: "Go home", href: "/", type: "default" }])
      );
      return NextResponse.redirect(
        `${origin}/auth/error?title=${encodeURIComponent("Invalid link")}&message=${encodeURIComponent("The authentication link is invalid.")}&actions=${actions}&error=validation_failed`
      );
    }

    // Handle email change confirmation
    if (type === "email_change") {
      console.log(
        "[AUTH] /api/auth/callback - Processing email change confirmation"
      );

      // Verify the email change token
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: "email_change",
      });

      if (error) {
        console.error(
          "[AUTH] /api/auth/callback - Email change verification failed",
          {
            error: error.message,
            code: error.status,
          }
        );

        // Don't log the user out - just redirect them back to account page with error
        return NextResponse.redirect(
          `${origin}/account?message=${encodeURIComponent("There was a problem changing your email. Please try again.")}`
        );
      }

      console.log(
        "[AUTH] /api/auth/callback - Email change verified successfully"
      );
      console.log(
        "[AUTH] /api/auth/callback - Email confirmed, redirecting to post-auth"
      );

      const postAuthUrl = new URL(`${origin}/api/auth/post-auth`);
      postAuthUrl.searchParams.set("provider", "email");
      postAuthUrl.searchParams.set("next", next);
      postAuthUrl.searchParams.set("should_refresh", "true");
      return NextResponse.redirect(postAuthUrl.toString());
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
      const { user, error: userError } = await getUser({ supabase });
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

      // Create device session with high trust (user proved ownership through email)
      const parser = new UAParser(request.headers.get("user-agent") || "");
      const deviceName = parser.getDevice().model || "Unknown Device";
      const browser = parser.getBrowser().name || "Unknown Browser";
      const os = parser.getOS().name || "Unknown OS";

      const currentDevice = {
        user_id: user.id,
        device_name: deviceName,
        browser,
        os,
        ip_address: request.headers.get("x-forwarded-for") || "::1",
      };

      const session_id = await createDeviceSession({
        user_id: user.id,
        device: currentDevice,
        confidence_score: 100,
        needs_verification: false,
        is_trusted: true,
      });

      // Check if user has 2FA enabled
      const { has2FA, factors } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });
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
        console.log(
          "[AUTH] /api/auth/callback - Adding 2FA params to reset URL"
        );
      }

      // Create response AFTER all URL parameters have been set
      const response = NextResponse.redirect(resetUrl);

      // Set device session cookie
      response.cookies.set("device_session_id", session_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: AUTH_CONFIG.deviceSessions.maxAge * 24 * 60 * 60, // Convert days to seconds
      });

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
    console.error("[AUTH] /api/auth/callback - Invalid callback type", {
      type,
    });

    const actions = encodeURIComponent(
      JSON.stringify([
        { label: "Log in", href: "/auth/login", type: "default" },
        { label: "Go home", href: "/", type: "secondary" },
      ])
    );
    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("Invalid request")}&message=${encodeURIComponent("The authentication request was invalid. Please try logging in again.")}&actions=${actions}&error=validation_failed`
    );
  } catch (error) {
    console.error("[AUTH] /api/auth/callback - Error processing request", {
      error: error instanceof Error ? error.message : error,
    });

    const actions = encodeURIComponent(
      JSON.stringify([
        { label: "Log in", href: "/auth/login", type: "default" },
        { label: "Go home", href: "/", type: "secondary" },
      ])
    );
    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent("An error occurred")}&message=${encodeURIComponent("There was a problem processing your request. Please try again later or contact support.")}&actions=${actions}&error=internal_error`
    );
  }
}
