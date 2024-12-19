"use server";

import { createClient } from "@/utils/supabase/server";

type GoogleAuthResponse = {
  error?: string;
  url?: string;
};

export async function signInWithGoogle(): Promise<GoogleAuthResponse> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Google OAuth error:", error);
    return { error: error.message };
  }

  // Return the URL to the client
  return { url: data?.url };
}
