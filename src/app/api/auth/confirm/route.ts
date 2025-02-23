import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    redirect(
      `/auth/error?error=missing_params&message=${encodeURIComponent("Missing token_hash or type parameter")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (!error) {
    // For email change verifications, redirect to our success page
    if (type === "email_change") {
      redirect("/auth/email-verified");
    }
    // For other verifications (signup, etc), continue with normal flow
    redirect(
      `/api/auth/post-auth?provider=email&next=${next}&should_refresh=true`
    );
  }

  const errorType = error.message.includes("expired") ? "expired" : "invalid";
  redirect(
    `/auth/error?error=confirm_${errorType}&message=${encodeURIComponent(error.message)}`
  );
}
