import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createUser } from "@/actions/auth/create-user";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    redirect(`/auth/error?error=missing_params`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (!error) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error: createError } = await createUser({
        id: user.id,
        email: user.email!,
        auth_method: "email",
      });

      if (createError) {
        console.error("Error creating user profile:", createError);
        redirect(`/auth/error?error=profile_creation_failed`);
      }
    }

    redirect(next);
  }

  const errorType = error.message.includes("expired") ? "expired" : "invalid";
  redirect(`/auth/error?error=confirm_${errorType}`);
}
