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
    redirect(`/api/auth/complete?provider=email&next=${next}`);
  }

  const errorType = error.message.includes("expired") ? "expired" : "invalid";
  redirect(
    `/auth/error?error=confirm_${errorType}&message=${encodeURIComponent(error.message)}`
  );
}
