import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TApiErrorResponse, TGetUserResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUser,
  getUserVerificationMethods,
  getAuthenticatorAssuranceLevel,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { getCurrentDeviceSession } from "@/utils/auth/device-sessions/server";

export async function GET(request: NextRequest) {
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

    if (error || !user) {
      // Temporary errors
      if (error instanceof AuthRetryableFetchError) {
        console.error("[USER ROUTE] Temporary error getting user:", error);
        return NextResponse.json(
          {
            error:
              "Unable to connect. Please check your internet connection and try again.",
          },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
      console.error("[USER ROUTE] Error getting user:", error);
      return NextResponse.json(
        { error: "An error occurred. Please try again." },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const deviceSessionId = getCurrentDeviceSessionId(request);

    // If user is null but there's a session cookie, it's likely expired/invalid
    if (!user && deviceSessionId) {
      // Force logout by clearing cookies and redirecting
      const logoutRes = await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });

      const setCookie = logoutRes.headers.get("set-cookie");
      const response = NextResponse.json(
        {
          error: "Authentication failed",
          redirect: `${origin}/auth/login?message=${encodeURIComponent("Your session has expired. Please log in again.")}`,
        },
        { status: 401 }
      );

      if (setCookie) {
        response.headers.set("Set-Cookie", setCookie);
      }

      return response;
    }

    // If no user and no session cookie, they are simply not logged in
    if (!user && !deviceSessionId) {
      // Return 401 Unauthorized, but no redirect as they might be on a public page
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // If we have a user, we need to validate the device session
    if (user) {
      const {
        deviceSession,
        isValid,
        error: sessionValidationError,
      } = await getCurrentDeviceSession({ request, supabase, user });

      if (sessionValidationError) {
        console.error(
          "[USER ROUTE] Error validating device session:",
          sessionValidationError
        );
        return NextResponse.json(
          { error: "Failed to validate session. Please try again." },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      if (!isValid || !deviceSession) {
        // Session is invalid or expired, force logout
        const logoutResult = await fetch(`${origin}/api/auth/logout`, {
          method: "POST",
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        });

        const setCookie = logoutResult.headers.get("set-cookie");
        const response = NextResponse.json(
          {
            error: "Authentication failed",
            redirect: `${origin}/auth/login?message=${encodeURIComponent(
              "Your session has expired. Please log in again."
            )}`,
          },
          { status: 401 }
        );

        if (setCookie) {
          response.headers.set("Set-Cookie", setCookie);
        }

        return response;
      }

      // --- Device Session is Valid ---

      // Check if user has 2FA enabled and validate AAL level (using the valid deviceSession.id)
      try {
        const { has2FA } = await getUserVerificationMethods({
          supabase,
          supabaseAdmin,
        });

        if (has2FA) {
          // Use the validated deviceSession.id here
          const currentAAL = await getAuthenticatorAssuranceLevel(
            supabase,
            deviceSession.id
          );
          if (currentAAL !== "aal2") {
            // User has 2FA but hasn't completed it - redirect to 2FA verification
            const { methods } = await getUserVerificationMethods({
              supabase,
              supabaseAdmin,
            });
            const availableMethods = encodeURIComponent(
              JSON.stringify(methods)
            );

            return NextResponse.json(
              {
                error: "2FA required",
                redirect: `/auth/login?requires_2fa=true&available_methods=${availableMethods}&next=${request.nextUrl.pathname}`,
              },
              { status: 401 }
            ) satisfies NextResponse<TApiErrorResponse>;
          }
        }
      } catch (error) {
        // Handle 2FA check errors without logging out
        console.error("[USER ROUTE] Error checking 2FA status:", error);
        return NextResponse.json(
          { error: "Failed to validate 2FA. Please try again." },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    return NextResponse.json(
      { user: user },
      { status: 200 }
    ) satisfies NextResponse<TGetUserResponse>;
  } catch (error) {
    console.error("[USER ROUTE] Unexpected error in user route:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
