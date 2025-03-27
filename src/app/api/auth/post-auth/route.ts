/**
 * This route handles the final steps of a login/signup
 * Such as creating a device session, checking for trusted sessions, etc.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { UAParser } from "ua-parser-js";
import {
  calculateDeviceTrust,
  getUserVerificationMethods,
  getUser,
} from "@/utils/auth";
import { TDeviceInfo, TDeviceSessionProvider } from "@/types/auth";
import { createDeviceSession } from "@/utils/auth/device-sessions/server";
import { AUTH_CONFIG } from "@/config/auth";
import { AuthApiError } from "@supabase/supabase-js";
import { TSendEmailAlertRequest } from "@/types/api";
import { logAccountEvent } from "@/utils/account-events/server";

export async function GET(request: Request) {
  const startTime = Date.now();

  console.log("[AUTH] Post-auth request received", {
    url: request.url,
  });

  const { searchParams, origin } = new URL(request.url);
  const provider = searchParams.get("provider");
  const next = searchParams.get("next") || "/";
  const shouldRefresh = searchParams.get("should_refresh") === "true";
  const isLocalEnv = process.env.NODE_ENV === "development";
  const isProviderConnection =
    searchParams.get("is_provider_connection") === "true";

  console.log("[AUTH] Post-auth parameters", {
    provider,
    next,
    shouldRefresh,
    isProviderConnection,
  });

  // Clean up the next URL to remove any OAuth codes
  const cleanNext = new URL(next, origin);
  cleanNext.searchParams.delete("code");

  console.log("[AUTH] Cleaned next URL:", {
    original: next,
    cleaned: cleanNext.toString(),
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

    // Check if the provider is enabled when using OAuth
    if (
      (provider === "google" && !AUTH_CONFIG.socialProviders.google.enabled) ||
      (provider === "github" && !AUTH_CONFIG.socialProviders.github.enabled)
    ) {
      console.error("OAuth provider is disabled but received OAuth provider", {
        provider,
      });

      // Redirect to error page instead of throwing an error
      return NextResponse.redirect(
        `${origin}/auth/error?error=${provider}_auth_disabled&message=${encodeURIComponent(`${provider} authentication is disabled`)}`
      );
    }

    console.log("[AUTH] Creating Supabase clients", {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
    });

    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { user, error } = await getUser({ supabase, requireProfile: false });
    if (error || !user) {
      console.error(`[AUTH] Failed to get user`, {
        error,
        hasUser: !!user,
        elapsed: `${Date.now() - startTime}ms`,
      });
      throw new Error("No user found");
    }

    console.log("[AUTH] User authenticated", {
      userId: user.id,
      email: user.email,
      elapsed: `${Date.now() - startTime}ms`,
      authProvider: user.auth.identities?.[0]?.provider,
      emailVerified: user.auth.emailVerified,
    });

    // Check if this is an OAuth provider
    const isOAuthProvider = provider === "google" || provider === "github";

    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (dbError) {
      console.log("Error fetching user from DB", {
        error: dbError.message,
        code: dbError.code,
      });
    }

    let isNewUser = false;

    if (!dbUser) {
      // Create user record for all new users
      console.log("Creating new user record", {
        userId: user.id,
      });

      isNewUser = true;

      const { error: createError } = await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        name: user.email?.split("@")[0] || "User",
        avatar_url: null,
        has_password: provider === "email", // only has password if signed up with email
      });

      if (createError) {
        console.error("Failed to create user", {
          error: createError.message,
          code: createError.code,
        });
        throw new Error("Failed to create user");
      }

      // Log account creation event
      const parser = new UAParser(request.headers.get("user-agent") || "");
      await logAccountEvent({
        user_id: user.id,
        event_type: "ACCOUNT_CREATED",
        metadata: {
          device: {
            device_name: parser.getDevice().model || "Unknown Device",
            browser: parser.getBrowser().name || null,
            os: parser.getOS().name || null,
            ip_address: request.headers.get("x-forwarded-for") || "::1",
          },
          category: "success",
          description: `New account created via ${provider} provider`,
        },
      });

      console.log("User record created successfully");
    }

    // For provider connections, we already have a device session
    // We don't want to create a new one
    if (isProviderConnection) {
      console.log("Skipping device session creation for provider connection");
      const response = NextResponse.redirect(cleanNext.toString(), {
        status: 302,
      });

      if (shouldRefresh) {
        response.headers.set("X-Should-Refresh-User", "true");
        console.log("Set refresh header");
      }

      return response;
    }

    console.log("Fetching trusted sessions");
    let trustedSessions = null;
    try {
      // Get all cookies from the request and forward them properly
      const cookieHeader = request.headers.get("cookie") || "";
      console.log("Forwarding cookies", {
        hasCookies: !!cookieHeader,
        cookieLength: cookieHeader.length,
      });

      // Create absolute URL for proper cookie handling
      const absoluteUrl = new URL(
        "/api/auth/device-sessions/trusted",
        origin
      ).toString();

      const trustedSessionsResponse = await fetch(absoluteUrl, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      if (!trustedSessionsResponse.ok) {
        console.error("Failed to get trusted sessions", {
          status: trustedSessionsResponse.status,
          statusText: trustedSessionsResponse.statusText,
          url: absoluteUrl,
        });

        // Just log the error but don't throw - fallback to empty trusted sessions
        if (trustedSessionsResponse.status === 401) {
          console.log("Falling back to empty trusted sessions due to 401");
        } else {
          // For any other error status, throw the original error
          throw new Error("Failed to get trusted sessions");
        }
      } else {
        // Only parse the response if it was successful
        const responseData = await trustedSessionsResponse.json();
        trustedSessions = responseData.data;
        console.log("Trusted sessions fetched", {
          count: trustedSessions ? trustedSessions.length : 0,
        });
      }
    } catch (error) {
      // Handle network errors but don't fail the authentication flow
      console.error("Error fetching trusted sessions", {
        error: error instanceof Error ? error.message : String(error),
      });
      console.log("Continuing with empty trusted sessions");
    }

    // Get device info
    const parser = new UAParser(request.headers.get("user-agent") || "");
    const deviceName = parser.getDevice().model || "Unknown Device";
    const browser = parser.getBrowser().name || "Unknown Browser";
    const os = parser.getOS().name || "Unknown OS";

    const currentDevice: TDeviceInfo = {
      user_id: user.id,
      device_name: deviceName,
      browser,
      os,
      ip_address: request.headers.get("x-forwarded-for") || "::1",
    };

    console.log("Current device info", {
      deviceName,
      browser,
      os,
      ip: currentDevice.ip_address,
    });

    const { has2FA, factors } = await getUserVerificationMethods({
      supabase,
      supabaseAdmin,
    });
    console.log("User verification methods", {
      has2FA,
      factorCount: factors.length,
    });

    // SECURITY: We use isNewUser to determine if this is the user's first device login,
    // NOT the absence of device sessions. This is critical because:
    // 1. No device sessions could mean: first login ever, logged out everywhere, sessions expired, or cleared sessions
    // 2. An attacker could wait for a moment when no sessions exist to gain unwarranted trust
    // 3. isNewUser specifically means "we just created this user's profile right now" which is reliable
    const { score, level, needsVerification, isTrusted } = calculateDeviceTrust(
      {
        trustedSessions: trustedSessions || null,
        currentDevice,
        isNewUser,
        isOAuthLogin: isOAuthProvider,
        has2FA,
      }
    );

    console.log("Device trust calculated", {
      score,
      level,
      needsVerification,
      isTrusted,
    });

    console.log("Setting up device session", {
      userId: user.id,
      provider,
      isNewUser,
      trust: { score, level, needsVerification, isTrusted },
    });

    const session_id = await createDeviceSession({
      user_id: user.id,
      device: currentDevice,
      confidence_score: score,
      needs_verification: needsVerification,
      is_trusted: isTrusted,
    });

    console.log("Device session created", {
      sessionId: session_id,
    });

    const response = NextResponse.redirect(cleanNext.toString(), {
      status: 302,
    });

    response.cookies.set("device_session_id", session_id, {
      httpOnly: true,
      secure: !isLocalEnv,
      sameSite: "lax",
      maxAge: AUTH_CONFIG.deviceSessions.maxAge * 24 * 60 * 60, // Convert days to seconds
    });

    console.log("[AUTH] Set device_session_id cookie", {
      sessionId: session_id,
      maxAge: AUTH_CONFIG.deviceSessions.maxAge * 24 * 60 * 60,
      secure: !isLocalEnv,
      elapsed: `${Date.now() - startTime}ms`,
    });

    if (shouldRefresh) {
      response.headers.set("X-Should-Refresh-User", "true");
      console.log("Set refresh header");
    }

    // If 2FA is required and this is an OAuth login, show 2FA form before proceeding
    if (has2FA && isOAuthProvider) {
      console.log("2FA required for OAuth login, redirecting to 2FA form", {
        trust: { score, level, needsVerification, isTrusted },
      });

      const verifyUrl = new URL(`${origin}/auth/login`);
      verifyUrl.searchParams.set("requires_2fa", "true");
      if (factors.length > 0) {
        verifyUrl.searchParams.set("factor_id", factors[0].factorId);
        verifyUrl.searchParams.set(
          "available_methods",
          JSON.stringify(factors)
        );
      }
      verifyUrl.searchParams.set("next", next);
      response.headers.set("Location", verifyUrl.toString());

      console.log("Redirecting to 2FA", {
        redirectUrl: verifyUrl.toString(),
      });

      return response;
    }

    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select("needs_verification")
      .eq("id", session_id)
      .single();

    if (sessionError) {
      console.error("Error getting device session", {
        error: sessionError.message,
        code: sessionError.code,
      });
    }

    if (session?.needs_verification) {
      console.log("Device session needs verification", {
        trust: { score, level, needsVerification, isTrusted },
      });

      try {
        console.log("Sending verification code");

        const sendCodeResponse = await fetch(
          `${origin}/api/auth/verify-device/send-code`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({
              device_session_id: session_id,
              device_name: deviceName,
            }),
          }
        );

        if (!sendCodeResponse.ok) {
          const error = await sendCodeResponse.json();
          console.error("Failed to send verification code", {
            status: sendCodeResponse.status,
            error: error.error,
          });

          throw new Error(
            error.error || "We couldn't send you a verification code right now."
          );
        }

        console.log("Verification code sent, redirecting to verify-device");

        response.headers.set(
          "Location",
          `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}`
        );
        return response;
      } catch (error) {
        console.error("Network error sending verification code", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        throw new Error("network_error");
      }
    }

    console.log("[AUTH] Authentication successful", {
      userId: user.id,
      redirectTo: next,
      elapsed: `${Date.now() - startTime}ms`,
      responseStatus: response.status,
      responseHeaders: {
        location: response.headers.get("location"),
        "x-should-refresh-user": response.headers.get("x-should-refresh-user"),
      },
    });

    // Send email alert based on configuration
    if (!isNewUser && AUTH_CONFIG.emailAlerts.login.enabled) {
      try {
        // First check if Resend is configured
        if (!process.env.RESEND_API_KEY) {
          console.log("Skipping email alert because Resend is not configured");
        } else {
          const shouldSendAlert =
            AUTH_CONFIG.emailAlerts.login.alertMode === "all" ||
            (AUTH_CONFIG.emailAlerts.login.alertMode === "unknown_only" &&
              score < AUTH_CONFIG.emailAlerts.login.confidenceThreshold);

          if (shouldSendAlert) {
            // Send the email alert
            const body: TSendEmailAlertRequest = {
              email: user.email,
              title: "New Login Detected",
              message: `A new login was detected from ${deviceName} (${browser} on ${os})`,
              device: {
                user_id: user.id,
                device_name: deviceName,
                browser,
                os,
                ip_address: currentDevice.ip_address,
              },
            };

            const emailAlertResponse = await fetch(
              `${origin}/api/auth/send-email-alert`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Cookie: request.headers.get("cookie") || "",
                },
                body: JSON.stringify(body),
              }
            );

            if (!emailAlertResponse.ok) {
              console.error("Failed to send email alert", {
                status: emailAlertResponse.status,
                statusText: emailAlertResponse.statusText,
              });
            } else {
              console.log("Email alert sent successfully");
            }
          } else {
            console.log("Skipping email alert based on configuration", {
              alertMode: AUTH_CONFIG.emailAlerts.login.alertMode,
              confidenceScore: score,
              threshold: AUTH_CONFIG.emailAlerts.login.confidenceThreshold,
              trust: { score, level, needsVerification, isTrusted },
            });
          }
        }
      } catch (error) {
        console.error("Error sending email alert", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("[AUTH] Post-auth flow completed", {
      url: cleanNext.toString(),
      totalTime: `${Date.now() - startTime}ms`,
    });

    return response;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    console.error("[AUTH] Post-auth flow failed", {
      error: err.message,
      totalTime: `${Date.now() - startTime}ms`,
    });

    // Always logout on error
    console.log("Logging out user due to error");
    await fetch(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    let errorTitle = "Authentication failed";
    let errorMessage =
      "There was a problem completing authentication. Please try again.";

    // Handle Supabase Auth errors
    if (err instanceof AuthApiError) {
      switch (err.status) {
        case 400:
          errorTitle = "Invalid request";
          errorMessage =
            "The authentication request was invalid. Please try again.";
          break;
        case 401:
          errorTitle = "Unauthorized";
          errorMessage = "You are not authorized to perform this action.";
          break;
        case 404:
          errorTitle = "Not found";
          errorMessage = "The requested resource was not found.";
          break;
        case 422:
          errorTitle = "Validation error";
          errorMessage =
            "There was a problem with your input. Please try again.";
          break;
        case 429:
          errorTitle = "Too many requests";
          errorMessage = "Please wait a moment before trying again.";
          break;
      }
    }

    const actions = encodeURIComponent(
      JSON.stringify([
        { label: "Try again", href: "/auth/login", type: "default" },
        { label: "Go home", href: "/", type: "secondary" },
      ])
    );

    console.log("Redirecting to error page", {
      error:
        err instanceof AuthApiError ? err.code || err.message : err.message,
    });

    return NextResponse.redirect(
      `${origin}/auth/error?title=${encodeURIComponent(errorTitle)}&message=${encodeURIComponent(errorMessage)}&actions=${actions}&error=${encodeURIComponent(err instanceof AuthApiError ? err.code || err.message : err.message)}`
    );
  }
}
