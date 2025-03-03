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
} from "@/utils/auth";
import { TDeviceInfo } from "@/types/auth";
import { setupDeviceSession } from "@/utils/device-sessions/server";
import type { TDeviceSessionProvider } from "@/utils/device-sessions/server";
import { AUTH_CONFIG } from "@/config/auth";

export async function GET(request: Request) {
  console.log("[AUTH] /api/auth/post-auth - Request received", {
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  const { searchParams } = new URL(request.url);
  const claimedProvider = (searchParams.get("provider") ||
    "browser") as TDeviceSessionProvider;
  const next = searchParams.get("next") || "/dashboard";
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocalEnv = process.env.NODE_ENV === "development";

  console.log("[AUTH] /api/auth/post-auth - Parameters", {
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
      claimedProvider === "email";
    if (!isValidProvider) {
      console.error("[AUTH] /api/auth/post-auth - Invalid provider", {
        provider: claimedProvider,
      });
      throw new Error("Invalid provider");
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[AUTH] /api/auth/post-auth - Failed to get user", {
        error: userError?.message,
        hasUser: !!user,
      });
      throw new Error("No user found");
    }

    console.log("[AUTH] /api/auth/post-auth - User authenticated", {
      userId: user.id,
      email: user.email,
    });

    // Determine the actual provider based on user metadata
    // Default to the claimed provider, but verify with user data when possible
    let provider: TDeviceSessionProvider = claimedProvider;

    if (user.identities && user.identities.length > 0) {
      const identity = user.identities[0];
      if (identity.provider === "google") {
        provider = "google";
      } else if (identity.provider === "email") {
        provider = "email";
      }
      // Add more providers here as they're supported
    }

    console.log("[AUTH] /api/auth/post-auth - Determined provider", {
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
      console.log("[AUTH] /api/auth/post-auth - Error fetching user from DB", {
        error: dbError.message,
        code: dbError.code,
      });
    }

    if (!dbUser) {
      console.log("[AUTH] /api/auth/post-auth - Creating new user record", {
        userId: user.id,
      });

      const { error: createError } = await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        name: user.email?.split("@")[0] || "User",
        avatar_url: null,
        has_password: provider === "email", // only has password if signed up with email
      });

      if (createError) {
        console.error("[AUTH] /api/auth/post-auth - Failed to create user", {
          error: createError.message,
          code: createError.code,
        });
        throw new Error("Failed to create user");
      }

      console.log(
        "[AUTH] /api/auth/post-auth - User record created successfully"
      );
    }

    console.log("[AUTH] /api/auth/post-auth - Fetching trusted sessions");
    let trustedSessions = null;
    try {
      // Get all cookies from the request and forward them properly
      const cookieHeader = request.headers.get("cookie") || "";
      console.log("[AUTH] /api/auth/post-auth - Forwarding cookies", {
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
        console.error(
          "[AUTH] /api/auth/post-auth - Failed to get trusted sessions",
          {
            status: trustedSessionsResponse.status,
            statusText: trustedSessionsResponse.statusText,
            url: absoluteUrl,
          }
        );

        // Just log the error but don't throw - fallback to empty trusted sessions
        if (trustedSessionsResponse.status === 401) {
          console.log(
            "[AUTH] /api/auth/post-auth - Falling back to empty trusted sessions due to 401"
          );
        } else {
          // For any other error status, throw the original error
          throw new Error("Failed to get trusted sessions");
        }
      } else {
        // Only parse the response if it was successful
        const responseData = await trustedSessionsResponse.json();
        trustedSessions = responseData.data;
        console.log("[AUTH] /api/auth/post-auth - Trusted sessions fetched", {
          count: trustedSessions ? trustedSessions.length : 0,
        });
      }
    } catch (error) {
      // Handle network errors but don't fail the authentication flow
      console.error(
        "[AUTH] /api/auth/post-auth - Error fetching trusted sessions",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      console.log(
        "[AUTH] /api/auth/post-auth - Continuing with empty trusted sessions"
      );
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

    console.log("[AUTH] /api/auth/post-auth - Current device info", {
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
    console.log("[AUTH] /api/auth/post-auth - Device confidence", {
      score,
      confidenceLevel,
    });

    const { has2FA, factors } = await getUserVerificationMethods(supabase);
    console.log("[AUTH] /api/auth/post-auth - User verification methods", {
      has2FA,
      factorCount: factors.length,
    });

    console.log("[AUTH] /api/auth/post-auth - Setting up device session", {
      userId: user.id,
      trustLevel: isOAuthProvider ? "oauth" : "normal",
      skipVerification: has2FA,
      provider,
    });

    const session_id = await setupDeviceSession(request, user.id, {
      trustLevel: isOAuthProvider ? "oauth" : "normal",
      skipVerification: has2FA, // Skip device verification if 2FA is required
      provider,
    });

    console.log("[AUTH] /api/auth/post-auth - Device session created", {
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

    console.log("[AUTH] /api/auth/post-auth - Set device_session_id cookie");

    const shouldRefresh = searchParams.get("should_refresh") === "true";
    if (shouldRefresh) {
      response.headers.set("X-Should-Refresh-User", "true");
      console.log("[AUTH] /api/auth/post-auth - Set refresh header");
    }

    // If 2FA is required and this is an OAuth login, show 2FA form before proceeding
    if (has2FA && isOAuthProvider) {
      console.log(
        "[AUTH] /api/auth/post-auth - 2FA required for OAuth login, redirecting to 2FA form"
      );

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

      console.log("[AUTH] /api/auth/post-auth - Redirecting to 2FA", {
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
      console.error(
        "[AUTH] /api/auth/post-auth - Error getting device session",
        {
          error: sessionError.message,
          code: sessionError.code,
        }
      );
    }

    if (session?.needs_verification) {
      console.log(
        "[AUTH] /api/auth/post-auth - Device session needs verification"
      );

      try {
        console.log("[AUTH] /api/auth/post-auth - Sending verification code");

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
          console.error(
            "[AUTH] /api/auth/post-auth - Failed to send verification code",
            {
              status: sendCodeResponse.status,
              error: error.error,
            }
          );

          throw new Error(
            error.error || "We couldn't send you a verification code right now."
          );
        }

        console.log(
          "[AUTH] /api/auth/post-auth - Verification code sent, redirecting to verify-device"
        );

        response.headers.set(
          "Location",
          `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}`
        );
        return response;
      } catch (error) {
        console.error(
          "[AUTH] /api/auth/post-auth - Network error sending verification code",
          {
            error: error instanceof Error ? error.message : "Unknown error",
          }
        );

        throw new Error("network_error");
      }
    }

    console.log(
      "[AUTH] /api/auth/post-auth - Authentication successful, redirecting to",
      next
    );
    return response;
  } catch (error) {
    const err = error as Error;
    console.error("[AUTH] /api/auth/post-auth - Error in post-auth flow", {
      error: err.message,
      stack: err.stack,
    });

    // Always logout on error
    console.log("[AUTH] /api/auth/post-auth - Logging out user due to error");
    await fetch(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    // Determine error type from message
    let errorType = "unknown_error";
    if (err.message.includes("No user found")) errorType = "failed_to_get_user";
    else if (err.message.includes("row-level security policy"))
      errorType = "failed_to_create_user";
    else if (err.message.includes("device session"))
      errorType = "failed_to_create_session";
    else if (err.message.includes("trusted sessions"))
      errorType = "failed_to_get_trusted_sessions";

    console.log("[AUTH] /api/auth/post-auth - Redirecting to error page", {
      errorType,
      message: err.message,
    });

    return NextResponse.redirect(
      `${origin}/auth/error?error=${errorType}&message=${encodeURIComponent(err.message)}`
    );
  }
}
