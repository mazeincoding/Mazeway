import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TApiErrorResponse, TGetUserResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUser,
  getDeviceSessionId,
  getUserVerificationMethods,
  getAuthenticatorAssuranceLevel,
} from "@/utils/auth";

export async function GET(request: NextRequest) {
  console.log("GET request received");
  try {
    if (apiRateLimit) {
      const ip = getClientIp(request);
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const { origin } = new URL(request.url);
    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });
    const { user, error } = await getUser({ supabase });

    // Handle no user or auth error
    if (error || !user) {
      // Clear any existing session
      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });

      // Return redirect response
      return NextResponse.redirect(
        `${origin}/auth/login?message=${encodeURIComponent("Please log in to continue")}`
      );
    }

    // Get device session ID
    console.log("Getting device session ID");
    const deviceSessionId = getDeviceSessionId(request);
    console.log("Device session ID:", deviceSessionId);
    if (!deviceSessionId) {
      console.log("No device session ID found");
      // Clear any existing session
      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });

      // Return redirect response
      return NextResponse.redirect(
        `${origin}/auth/login?message=${encodeURIComponent("Your session has expired. Please log in again.")}`
      );
    }

    // Validate that the device session exists and is valid
    const { count, error: sessionError } = await supabase
      .from("device_sessions")
      .select("*", { count: "exact", head: true })
      .eq("id", deviceSessionId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString());

    if (sessionError || count === 0) {
      console.log("Session error or count is 0");
      // Clear any existing session
      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });

      // Return redirect response
      return NextResponse.redirect(
        `${origin}/auth/login?message=${encodeURIComponent("Your session has expired. Please log in again.")}`
      );
    }

    // Check if user has 2FA enabled and validate AAL level
    const { has2FA } = await getUserVerificationMethods({
      supabase,
      supabaseAdmin,
    });
    if (has2FA) {
      const currentAAL = await getAuthenticatorAssuranceLevel(
        supabase,
        deviceSessionId
      );
      if (currentAAL !== "aal2") {
        // User has 2FA but hasn't completed it - redirect to 2FA verification
        const { factors } = await getUserVerificationMethods({
          supabase,
          supabaseAdmin,
        });
        const availableMethods = encodeURIComponent(JSON.stringify(factors));
        const factorId = factors[0]?.factorId;

        return NextResponse.redirect(
          `${origin}/auth/login?requires_2fa=true&factor_id=${factorId}&available_methods=${availableMethods}&next=${request.nextUrl.pathname}`
        );
      }
    }

    return NextResponse.json({
      user,
    }) satisfies NextResponse<TGetUserResponse>;
  } catch (error) {
    console.error("Error in get user:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
