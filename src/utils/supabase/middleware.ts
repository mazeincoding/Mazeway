import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
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
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
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

  const protectedPaths = ["/dashboard", "/account"];
  const authPaths = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/reset-password",
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPath = authPaths.some(
    (path) => request.nextUrl.pathname === path
  );
  const isApiPath = request.nextUrl.pathname.startsWith("/api/");

  // If there's a user session
  if (user) {
    // Real security lives in API routes for sensitive actions
    // We don't need to do a full DB check here
    if (isProtectedPath) {
      const deviceSessionId = request.cookies.get("device_session_id");
      if (!deviceSessionId) {
        if (isApiPath) {
          return NextResponse.json(
            { message: "No device session" },
            { status: 401 }
          );
        }
        // No device session, just logout
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
        url.searchParams.set(
          "message",
          "Your session was invalid. Please log in again."
        );
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
    }

    // Redirect authenticated users away from auth paths
    if (isAuthPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Handle unauthenticated requests
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

  return response;
}
