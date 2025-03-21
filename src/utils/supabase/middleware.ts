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
  const authPaths = ["/", "/auth/login", "/auth/signup"];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPath = authPaths.some(
    (path) => request.nextUrl.pathname === path
  );
  const isApiPath = request.nextUrl.pathname.startsWith("/api/");

  // If there's a user session
  if (user) {
    // Don't redirect if we're going to 2FA verification
    const requires2FA =
      request.nextUrl.searchParams.get("requires_2fa") === "true";

    // Redirect authenticated users away from auth paths UNLESS 2FA is required
    if (isAuthPath && !requires2FA) {
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
