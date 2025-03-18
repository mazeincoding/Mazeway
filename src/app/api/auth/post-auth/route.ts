/**
 * This route handles the final steps of a login/signup
 * Such as creating a device session, checking for trusted sessions, etc.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { UAParser } from "ua-parser-js";
import {
  calculateDeviceConfidence,
  getUserVerificationMethods,
  getConfidenceLevel,
  getUser,
} from "@/utils/auth";
import { TDeviceInfo, TDeviceSessionProvider } from "@/types/auth";
import { setupDeviceSession } from "@/utils/auth/device-sessions/server";
import { AUTH_CONFIG } from "@/config/auth";
import { AuthApiError } from "@supabase/supabase-js";
import { TSendEmailAlertRequest } from "@/types/api";
import { logAccountEvent } from "@/utils/account-events/server";

export async function GET(request: Request) {
  console.log("Request received", {
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  const { searchParams } = new URL(request.url);
  const claimedProvider = (searchParams.get("provider") ||
    "browser") as TDeviceSessionProvider;
  const next = searchParams.get("next") || "/dashboard";
  const { origin } = new URL(request.url);
  const isLocalEnv = process.env.NODE_ENV === "development";

  console.log("Parameters", {
    claimedProvider,
    next,
    origin,
    isLocalEnv,
  });

  try {
    // Validate claimed provider is one we actually support
    const isValidProvider =
      claimedProvider === "browser" ||
      claimedProvider === "google" ||
      claimedProvider === "github" ||
      claimedProvider === "email";
    if (!isValidProvider) {
      console.error("Invalid provider", {
        provider: claimedProvider,
      });
      throw new Error("Invalid provider");
    }

    // Check if the provider is enabled when using OAuth
    if (
      (claimedProvider === "google" &&
        !AUTH_CONFIG.socialProviders.google.enabled) ||
      (claimedProvider === "github" &&
        !AUTH_CONFIG.socialProviders.github.enabled)
    ) {
      console.error("OAuth provider is disabled but received OAuth provider", {
        provider: claimedProvider,
      });

      // Redirect to error page instead of throwing an error
      return NextResponse.redirect(
        `${origin}/auth/error?error=${claimedProvider}_auth_disabled&message=${encodeURIComponent(`${claimedProvider} authentication is disabled`)}`
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { user, error } = await getUser({ supabase, requireProfile: false });
    if (error || !user) {
      console.error("Failed to get user", {
        error,
        hasUser: !!user,
      });
      throw new Error("No user found");
    }

    console.log("User authenticated", {
      userId: user.id,
      email: user.email,
    });

    // Determine the actual provider based on user metadata
    // Default to the claimed provider, but verify with user data when possible
    let provider: TDeviceSessionProvider = claimedProvider;

    if (user.auth.identities && user.auth.identities.length > 0) {
      const identity = user.auth.identities[0];
      if (identity.provider === "google") {
        provider = "google";
      } else if (identity.provider === "github") {
        provider = "github";
      } else if (identity.provider === "email") {
        provider = "email";
      }
      // Add more providers here as they're supported
    }

    console.log("Determined provider", {
      provider,
      claimedProvider,
    });

    const isOAuthProvider = provider !== "email" && provider !== "browser";

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
        },
      });

      console.log("User record created successfully");
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

    const score = calculateDeviceConfidence(
      trustedSessions || null,
      currentDevice
    );

    const confidenceLevel = getConfidenceLevel(score);
    console.log("Device confidence", {
      score,
      confidenceLevel,
    });

    const { has2FA, factors } = await getUserVerificationMethods({
      supabase,
      supabaseAdmin,
    });
    console.log("User verification methods", {
      has2FA,
      factorCount: factors.length,
    });

    console.log("Setting up device session", {
      userId: user.id,
      trustLevel: isOAuthProvider ? "oauth" : "normal",
      skipVerification: has2FA,
      provider,
      isNewUser,
    });

    const session_id = await setupDeviceSession({
      request,
      user_id: user.id,
      options: {
        trustLevel: isOAuthProvider ? "oauth" : "normal",
        skipVerification: has2FA, // Skip device verification if 2FA is required
        provider,
        isNewUser,
      },
    });

    console.log("Device session created", {
      sessionId: session_id,
    });

    const response = NextResponse.redirect(`${origin}${next}`, {
      status: 302,
    });

    response.cookies.set("device_session_id", session_id, {
      httpOnly: true,
      secure: !isLocalEnv,
      sameSite: "lax",
      maxAge: AUTH_CONFIG.deviceSessions.maxAge * 24 * 60 * 60, // Convert days to seconds
    });

    console.log("Set device_session_id cookie");

    const shouldRefresh = searchParams.get("should_refresh") === "true";
    if (shouldRefresh) {
      response.headers.set("X-Should-Refresh-User", "true");
      console.log("Set refresh header");
    }

    // If 2FA is required and this is an OAuth login, show 2FA form before proceeding
    if (has2FA && isOAuthProvider) {
      console.log("2FA required for OAuth login, redirecting to 2FA form");

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
      console.log("Device session needs verification");

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

    console.log("Authentication successful, redirecting to", next);

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
              // Just log the error but don't fail the authentication flow
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
            });
          }
        }
      } catch (error) {
        // Log error but don't fail the authentication flow
        console.error("Error sending email alert", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return response;
  } catch (error) {
    const err = error as Error;
    console.error("Error in post-auth flow", {
      error: err.message,
      stack: err.stack,
    });

    // Always logout on error
    console.log("Logging out user due to error");
    await fetch(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    let errorTitle = "Authentication error";
    let errorMessage = "There was a problem completing your authentication.";

    // Handle Supabase Auth errors
    if (err instanceof AuthApiError) {
      switch (err.code) {
        case "user_not_found":
          errorTitle = "Session Error";
          errorMessage =
            "We couldn't find your user session. Please try logging in again.";
          break;
        case "user_already_exists":
          errorTitle = "Account Creation Failed";
          errorMessage =
            "We couldn't create your account. Please try signing up again.";
          break;
        // Add other Supabase error codes as needed
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
