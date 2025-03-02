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
  const { searchParams } = new URL(request.url);
  const claimedProvider = (searchParams.get("provider") ||
    "browser") as TDeviceSessionProvider;
  const next = searchParams.get("next") || "/dashboard";
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocalEnv = process.env.NODE_ENV === "development";

  try {
    // Validate claimed provider is one we actually support
    const isValidProvider =
      claimedProvider === "browser" ||
      claimedProvider === "google" ||
      claimedProvider === "email";
    if (!isValidProvider) {
      throw new Error("Invalid provider");
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error("No user found");

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

    const isOAuthProvider = provider !== "email" && provider !== "browser";

    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!dbUser) {
      const { error: createError } = await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        name: user.email?.split("@")[0] || "User",
        avatar_url: null,
        has_password: provider === "email", // only has password if signed up with email
      });

      if (createError) {
        throw new Error("Failed to create user");
      }
    }

    const trustedSessionsResponse = await fetch(
      `${origin}/api/auth/device-sessions/trusted`,
      {
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      }
    );

    if (!trustedSessionsResponse.ok) {
      throw new Error("Failed to get trusted sessions");
    }

    const { data: trustedSessions } = await trustedSessionsResponse.json();

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

    const score = calculateDeviceConfidence(
      trustedSessions || null,
      currentDevice
    );

    const confidenceLevel = getConfidenceLevel(score);

    const { has2FA, factors } = await getUserVerificationMethods(supabase);

    const session_id = await setupDeviceSession(request, user.id, {
      trustLevel: isOAuthProvider ? "oauth" : "normal",
      skipVerification: has2FA, // Skip device verification if 2FA is required
      provider,
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

    const shouldRefresh = searchParams.get("should_refresh") === "true";
    if (shouldRefresh) {
      response.headers.set("X-Should-Refresh-User", "true");
    }

    // If 2FA is required and this is an OAuth login, show 2FA form before proceeding
    if (has2FA && isOAuthProvider) {
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
      return response;
    }

    const { data: session } = await supabase
      .from("device_sessions")
      .select("needs_verification")
      .eq("id", session_id)
      .single();

    if (session?.needs_verification) {
      try {
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
          throw new Error(
            error.error || "We couldn't send you a verification code right now."
          );
        }

        response.headers.set(
          "Location",
          `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}`
        );
        return response;
      } catch (error) {
        throw new Error("network_error");
      }
    }

    return response;
  } catch (error) {
    const err = error as Error;

    // Always logout on error
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

    return NextResponse.redirect(
      `${origin}/auth/error?error=${errorType}&message=${encodeURIComponent(err.message)}`
    );
  }
}
