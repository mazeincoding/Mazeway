/**
 * This route handles the final steps of a login/signup
 * Such as creating a device session, checking for trusted sessions, etc.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { UAParser } from "ua-parser-js";
import {
  calculateDeviceConfidence,
  checkTwoFactorRequirements,
  getConfidenceLevel,
} from "@/utils/auth";
import { TDeviceInfo } from "@/types/auth";
import { setupDeviceSession } from "@/utils/device-sessions/server";
import type { TDeviceSessionProvider } from "@/utils/device-sessions/server";
import { AUTH_CONFIG } from "@/config/auth";

export async function GET(request: Request) {
  console.log("[DEBUG] Post-auth started");
  const { searchParams } = new URL(request.url);
  const provider = (searchParams.get("provider") ||
    "browser") as TDeviceSessionProvider;
  const next = searchParams.get("next") || "/dashboard";
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocalEnv = process.env.NODE_ENV === "development";

  console.log("[DEBUG] Post-auth params:", { provider, next, origin });

  try {
    // Validate provider is one we actually support
    const isValidProvider =
      provider === "browser" || provider === "google" || provider === "email";
    if (!isValidProvider) {
      throw new Error("Invalid provider");
    }

    // Get the user with normal client for auth
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    console.log("[DEBUG] Got user:", {
      userId: user?.id,
      error: userError?.message,
    });

    if (userError || !user) throw new Error("No user found");

    // Verify user exists in our database
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();
    console.log("[DEBUG] Database user check:", {
      exists: !!dbUser,
      error: dbError?.message,
    });

    // Create user if they don't exist
    if (!dbUser) {
      console.log("[DEBUG] Creating new user in database");
      const { error: createError } = await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        name: user.email?.split("@")[0] || "User",
        avatar_url: null,
        has_password: provider === "email", // only has password if signed up with email
      });

      if (createError) {
        console.error("[DEBUG] Failed to create user:", createError);
        throw new Error("Failed to create user");
      }
      console.log("[DEBUG] User created successfully");
    }

    // Get trusted sessions
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

    console.log("[DEBUG] Trusted sessions:", {
      count: trustedSessions?.length,
    });

    if (trustedSessions?.length) {
      console.log("[DEBUG] First trusted session structure:", {
        hasDevice: "device" in (trustedSessions[0] || {}),
        keys: Object.keys(trustedSessions[0] || {}),
        deviceInfo: trustedSessions[0]?.device,
      });
    }

    // Parse user agent
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

    console.log("[DEBUG] Current device:", currentDevice);

    // Check the current device against trusted device sessions only
    const score = calculateDeviceConfidence(
      trustedSessions || null,
      currentDevice
    );

    const confidenceLevel = getConfidenceLevel(score);
    console.log("[DEBUG] Device confidence:", {
      score,
      level: confidenceLevel,
    });

    // Check if 2FA is required for this user
    const twoFactorResult = await checkTwoFactorRequirements(supabase);

    // Create device session with appropriate trust level
    const session_id = await setupDeviceSession(request, user.id, {
      trustLevel: provider === "google" ? "oauth" : "normal",
      skipVerification: twoFactorResult.requiresTwoFactor, // Skip device verification if 2FA is required
      provider,
    });

    // Create base response that will be used for all redirects
    const response = NextResponse.redirect(`${origin}${next}`, {
      status: 302,
    });

    // Set the device session ID cookie
    response.cookies.set("device_session_id", session_id, {
      httpOnly: true,
      secure: !isLocalEnv,
      sameSite: "lax",
      maxAge: AUTH_CONFIG.deviceSessions.maxAge * 24 * 60 * 60, // Convert days to seconds
    });

    // Add refresh flag if needed
    const shouldRefresh = searchParams.get("should_refresh") === "true";
    if (shouldRefresh) {
      response.headers.set("X-Should-Refresh-User", "true");
    }

    // If 2FA is required and this is an OAuth login, show 2FA form before proceeding
    if (twoFactorResult.requiresTwoFactor && provider === "google") {
      const verifyUrl = new URL(`${origin}/auth/login`);
      verifyUrl.searchParams.set("requires_2fa", "true");
      if (twoFactorResult.factorId) {
        verifyUrl.searchParams.set("factor_id", twoFactorResult.factorId);
        verifyUrl.searchParams.set(
          "available_methods",
          JSON.stringify(twoFactorResult.availableMethods)
        );
      }
      verifyUrl.searchParams.set("next", next);
      response.headers.set("Location", verifyUrl.toString());
      return response;
    }

    // If verification is needed, redirect to verification page
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
          console.error("[DEBUG] Failed to send verification code:", error);
          throw new Error(
            error.error || "We couldn't send you a verification code right now."
          );
        }

        console.log("[DEBUG] Verification code sent successfully");

        // Redirect to verification page using the base response
        response.headers.set(
          "Location",
          `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}`
        );
        return response;
      } catch (error) {
        console.error("[DEBUG] Verification code error:", error);
        throw new Error("network_error");
      }
    }

    return response;
  } catch (error) {
    const err = error as Error;
    console.error("[DEBUG] Post-auth error:", {
      message: err.message,
      stack: err.stack,
    });

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
