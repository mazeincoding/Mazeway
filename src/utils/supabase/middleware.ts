import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const protectedPaths = ["/dashboard", "/account", "/api/send-email-alert"];
  const authPaths = ["/", "/auth/login", "/auth/signup"];
  const passwordResetPath = "/auth/reset-password";

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPath = authPaths.some(
    (path) => request.nextUrl.pathname === path
  );
  const isPasswordResetPath = request.nextUrl.pathname === passwordResetPath;
  const isApiPath = request.nextUrl.pathname.startsWith("/api/");

  if (user) {
    // Allow post-auth and error routes to run without device session
    if (
      request.nextUrl.pathname === "/api/auth/post-auth" ||
      request.nextUrl.pathname.startsWith("/auth/error")
    ) {
      return supabaseResponse;
    }

    // Only check device session on protected routes
    if (isProtectedPath) {
      const deviceSessionId = request.cookies.get("device_session_id");

      if (!deviceSessionId) {
        // No device session, redirect to post-auth to set up device session
        const url = request.nextUrl.clone();
        url.pathname = "/api/auth/post-auth";
        url.searchParams.set("provider", "browser");
        url.searchParams.set("next", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }

      // Query device session by ID
      const { data: deviceSession } = await supabase
        .from("device_sessions")
        .select("needs_verification")
        .eq("session_id", deviceSessionId.value)
        .eq("user_id", user.id)
        .single();

      if (!deviceSession) {
        const origin = new URL(request.url).origin;
        const logoutRequest = new Request(`${origin}/api/auth/logout`, {
          method: "POST",
          headers: request.headers,
        });

        try {
          const logoutResponse = await fetch(logoutRequest);
          if (!logoutResponse.ok) {
            throw new Error("Logout failed");
          }

          // Create redirect response
          const redirectResponse = NextResponse.redirect(
            new URL("/auth/login", request.url)
          );

          // Copy the cookie deletions from the logout response
          logoutResponse.headers.getSetCookie().forEach((cookie) => {
            redirectResponse.headers.append("Set-Cookie", cookie);
          });

          return redirectResponse;
        } catch (error) {
          return NextResponse.redirect(new URL("/auth/error", request.url));
        }
      }

      // Redirect to verification if needed
      if (deviceSession.needs_verification) {
        const verificationPaths = [
          "/auth/verify-device",
          "/api/auth/verify-device",
        ];
        const isVerificationPath = verificationPaths.some((path) =>
          request.nextUrl.pathname.startsWith(path)
        );

        if (!isVerificationPath) {
          const url = request.nextUrl.clone();
          url.pathname = "/auth/verify-device";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // Redirect to login if accessing protected route while not authenticated
  if (!user && isProtectedPath) {
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

  // Special handling for password reset page
  if (isPasswordResetPath) {
    // Allow access only if user has a recovery session or is fully authenticated
    if (!user || (user.aud !== "recovery" && !user)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
