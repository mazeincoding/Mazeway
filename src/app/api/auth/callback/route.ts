import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  console.log("[DEBUG] Auth callback started");
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  console.log("[DEBUG] Callback params:", {
    code: !!code,
    token_hash,
    type,
    next,
  });

  const supabase = await createClient();

  // Handle OAuth callback (Google)
  if (code) {
    console.log("[DEBUG] Processing OAuth callback");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[DEBUG] Exchange result:", {
      success: !error,
      userId: data?.user?.id,
      error: error?.message,
    });

    if (error) {
      console.error("[DEBUG] OAuth exchange failed:", error);
      return NextResponse.redirect(
        `${origin}/auth/error?error=google_callback_error&message=${encodeURIComponent(error.message)}`
      );
    }

    return NextResponse.redirect(
      `${origin}/api/auth/post-auth?provider=google&next=${next}`
    );
  }

  // Handle password reset callback
  if (token_hash && type === "recovery") {
    console.log("[DEBUG] Processing password reset");
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "recovery",
    });
    if (error) {
      console.error("[DEBUG] Password reset failed:", error);
      return NextResponse.redirect(
        `${origin}/auth/error?error=reset_password_error&message=${encodeURIComponent(error.message)}`
      );
    }
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // No valid callback parameters
  console.log("[DEBUG] Invalid callback - no valid parameters");
  return NextResponse.redirect(
    `${origin}/auth/error?error=invalid_callback&message=${encodeURIComponent("Invalid callback request")}`
  );
}
