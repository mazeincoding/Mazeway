import { createServerClient } from "@supabase/ssr";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  let user = null;
  let userError = null;
  try {
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

    // Special case where we don't use our getUser() utility
    // We probably could but who's gonna risk that with the comment above?
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    userError = error;
    if (error) {
      console.error("Error getting user in middleware:", error);
    }
  } catch (error) {
    // Temporary errors like network connectivity
    if (error instanceof AuthRetryableFetchError) {
      console.error("Temporary error in middleware:", error);
      console.log("Response:", response);
      return response;
    }
    // For other errors, log them but treat as no user
    console.error("Error getting user in middleware:", error);
  }

  const protectedPaths = ["/dashboard", "/account"];
  const authPaths = ["/", "/auth/login", "/auth/signup"];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPath = authPaths.some(
    (path) => request.nextUrl.pathname === path
  );

  // If there's a user session
  if (user) {
    // Don't redirect if we're going to 2FA verification
    const requires2FA =
      request.nextUrl.searchParams.get("requires_2fa") === "true";
    const isTemporaryError = userError instanceof AuthRetryableFetchError;

    // Redirect authenticated users away from auth paths UNLESS 2FA is required
    if (isAuthPath && !requires2FA && !isTemporaryError) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Handle unauthenticated requests
  if (
    !user &&
    isProtectedPath &&
    !(userError instanceof AuthRetryableFetchError)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    console.log("User error:", userError);
    console.log(
      "Is userError an instance of AuthRetryableFetchError?",
      userError instanceof AuthRetryableFetchError
    );
    console.log("Redirecting to login bye");
    return NextResponse.redirect(url);
  }

  return response;
}
