import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { TApiErrorResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const { origin } = new URL(request.url);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/api/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ url: data?.url });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
