import { createServerClient } from "@supabase/ssr";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthenticatorAssuranceLevel,
  getUserVerificationMethods,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";

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
    // Only check AAL for protected paths
    if (isProtectedPath) {
      try {
        // Get the device session ID from the request
        const deviceSessionId = getCurrentDeviceSessionId(request);

        if (deviceSessionId) {
          // Create supabase server client for auth operations
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

          // Create supabase admin client for checking backup codes
          const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

          // Check if 2FA is enabled for the user
          const { has2FA, methods = [] } = await getUserVerificationMethods({
            supabase,
            supabaseAdmin,
          });

          // Check the current AAL level
          const currentAAL = await getAuthenticatorAssuranceLevel(
            supabase,
            deviceSessionId
          );

          // If user has 2FA enabled but is only at AAL1 and not already going to 2FA verification
          if (
            has2FA &&
            currentAAL === "aal1" &&
            request.nextUrl.searchParams.get("requires_2fa") !== "true"
          ) {
            // Create a URL to redirect to login with proper 2FA parameters
            const url = request.nextUrl.clone();
            url.pathname = "/auth/login";
            url.searchParams.set("requires_2fa", "true");
            url.searchParams.set("available_methods", JSON.stringify(methods));

            // If we have a next URL, preserve it
            const nextUrl = request.nextUrl.searchParams.get("next");
            if (nextUrl) {
              url.searchParams.set("next", nextUrl);
            } else {
              url.searchParams.set("next", request.nextUrl.pathname);
            }

            if (user.email) {
              url.searchParams.set("email", encodeURIComponent(user.email));
            }

            return NextResponse.redirect(url);
          }
        }
      } catch (error) {
        console.error("Error checking AAL in middleware:", error);
      }
    }

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
    return NextResponse.redirect(url);
  }

  return response;
}
