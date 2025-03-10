import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getUserVerificationMethods,
  getAuthenticatorAssuranceLevel,
} from "@/utils/auth";
import { AUTH_CONFIG } from "@/config/auth";

async function handleInvalidDeviceSession(request: NextRequest) {
  // Call logout API to clean up all auth state
  const logoutResponse = await fetch(
    `${request.nextUrl.origin}/api/auth/logout`,
    {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    }
  );

  // Redirect to login with cookies from logout response
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  const response = NextResponse.redirect(url);

  // Forward the Set-Cookie headers from logout response
  const setCookieHeader = logoutResponse.headers.get("Set-Cookie");
  if (setCookieHeader) {
    setCookieHeader.split(",").forEach((cookie) => {
      response.headers.append("Set-Cookie", cookie.trim());
    });
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = [
    "/dashboard",
    "/account",
    "/api/auth/send-email-alert",
  ];
  const authPaths = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/login-help",
    "/auth/reset-password",
  ];
  const passwordResetPaths = [
    "/auth/reset-password",
    "/api/auth/reset-password",
  ];
  const recoveryPaths = [
    ...passwordResetPaths,
    "/api/auth/callback",
    "/auth/error",
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPath = authPaths.some(
    (path) => request.nextUrl.pathname === path
  );
  const isPasswordResetPath = passwordResetPaths.some(
    (path) => request.nextUrl.pathname === path
  );
  const isRecoveryPath = recoveryPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isApiPath = request.nextUrl.pathname.startsWith("/api/");

  // If there's a user session
  if (user) {
    // Check if it's a recovery session
    const isRecoverySession = user.aud === "recovery";

    // Recovery sessions can only access recovery-related paths
    if (isRecoverySession && !isRecoveryPath) {
      if (isApiPath) {
        return NextResponse.json(
          { message: "Unauthorized access with recovery session" },
          { status: 401 }
        );
      }
      // Redirect recovery sessions trying to access other paths to login
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }

    // Regular sessions need device verification
    if (!isRecoverySession) {
      // Allow post-auth and error routes to run without device session
      if (
        request.nextUrl.pathname === "/api/auth/post-auth" ||
        request.nextUrl.pathname.startsWith("/auth/error")
      ) {
        return supabaseResponse;
      }

      // Check if 2FA is required for this user
      const { has2FA } = await getUserVerificationMethods(supabase);

      // If 2FA is required, check AAL2 status
      if (has2FA) {
        const deviceSessionId = request.cookies.get("device_session_id");

        const currentLevel = await getAuthenticatorAssuranceLevel(
          supabase,
          deviceSessionId?.value || ""
        );

        // If user needs AAL2 but doesn't have it, treat them as unauthenticated
        if (currentLevel !== "aal2") {
          // Block protected routes and APIs
          if (isProtectedPath) {
            if (isApiPath) {
              return NextResponse.json(
                { message: "Two-factor authentication required" },
                { status: 401 }
              );
            }
            // Redirect to login for protected routes
            const url = request.nextUrl.clone();
            url.pathname = "/auth/login";
            return NextResponse.redirect(url);
          }
          // Allow access to public routes
          return supabaseResponse;
        }
      }

      // Only check device session on protected routes
      if (isProtectedPath) {
        const deviceSessionId = request.cookies.get("device_session_id");
        const verificationPaths = [
          "/auth/verify-device",
          "/api/auth/verify-device",
        ];
        const isVerificationPath = verificationPaths.some((path) =>
          request.nextUrl.pathname.startsWith(path)
        );

        // Allow verification paths even without device session
        if (isVerificationPath) {
          return supabaseResponse;
        }

        // For all other protected routes, require valid device session
        if (!deviceSessionId) {
          if (isApiPath) {
            return NextResponse.json(
              { message: "Unauthorized - No device session" },
              { status: 401 }
            );
          }
          return handleInvalidDeviceSession(request);
        }

        // Query device session by ID
        const { data: deviceSession } = (await supabase
          .from("device_sessions")
          .select("needs_verification, expires_at")
          .eq("id", deviceSessionId.value)
          .eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString())
          .single()) as unknown as {
          data: { needs_verification: boolean; expires_at: string } | null;
        };

        if (!deviceSession) {
          if (isApiPath) {
            return NextResponse.json(
              { message: "Unauthorized - Invalid or expired device session" },
              { status: 401 }
            );
          }
          return handleInvalidDeviceSession(request);
        }

        // Redirect to verification if needed
        if (deviceSession.needs_verification) {
          if (!isVerificationPath) {
            const url = request.nextUrl.clone();
            url.pathname = "/auth/verify-device";
            return NextResponse.redirect(url);
          }
        }
      }

      // Redirect authenticated regular sessions away from auth paths
      if (isAuthPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  // Handle unauthenticated requests
  if (!user) {
    // Block access to protected routes
    if (isProtectedPath) {
      if (isApiPath) {
        return NextResponse.json(
          { message: "Unauthorized access" },
          { status: 401 }
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }

    // Allow password reset paths if recovery cookie is present (when required)
    if (isPasswordResetPath) {
      // Only check for recovery cookie if relogin is required after reset
      if (AUTH_CONFIG.passwordReset.requireReloginAfterReset) {
        const hasRecoveryCookie = request.cookies.has("recovery_session");
        if (!hasRecoveryCookie) {
          const url = request.nextUrl.clone();
          url.pathname = "/auth/login";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
