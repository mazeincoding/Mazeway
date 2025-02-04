import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createRecoveryToken } from "@/utils/auth/recovery-token";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  // Handle OAuth callback (Google)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=oauth_error&message=${encodeURIComponent(error.message)}`
      );
    }

    return NextResponse.redirect(
      `${origin}/api/auth/post-auth?provider=google&next=${next}`
    );
  }

  // For non-OAuth flows, verify required parameters
  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Missing parameters")}`
    );
  }

  // Handle password reset callback
  if (type === "recovery") {
    // Check initial state
    const { data: preCheck } = await supabase.auth.getSession();
    console.log("Pre-verification state:", {
      hasSession: !!preCheck.session,
      hasAccessToken: !!preCheck.session?.access_token,
      hasUser: !!preCheck.session?.user,
      sessionData: preCheck.session,
    });

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent(error.message)}`
      );
    }

    // Verify we have a valid session after OTP verification
    const { data: postCheck } = await supabase.auth.getSession();
    console.log("Post-verification state:", {
      hasSession: !!postCheck.session,
      hasAccessToken: !!postCheck.session?.access_token,
      hasUser: !!postCheck.session?.user,
      sessionData: postCheck.session,
    });

    if (!postCheck.session?.user?.id) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent("Invalid user session")}`
      );
    }

    // Create response for reset password redirect
    const response = NextResponse.redirect(`${origin}/auth/reset-password`);

    // Create encrypted recovery token with user ID
    const recoveryToken = createRecoveryToken(postCheck.session.user.id);

    // Set secure HTTP-only recovery cookie with 15 minute expiry
    response.cookies.set("recovery_session", recoveryToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    // Call logout endpoint to clear Supabase session
    await fetch(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    return response;
  }

  // Invalid type
  return NextResponse.redirect(
    `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Invalid callback request")}`
  );
}
