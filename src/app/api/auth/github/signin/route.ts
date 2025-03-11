import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { TApiErrorResponse } from "@/types/api";
import { AUTH_CONFIG } from "@/config/auth";

export async function POST(request: NextRequest) {
  try {
    // Check if GitHub auth is enabled in the config
    if (!AUTH_CONFIG.socialProviders.github.enabled) {
      return NextResponse.json(
        { error: "GitHub authentication is disabled" },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

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
      provider: "github",
      options: {
        redirectTo: `${origin}/api/auth/callback?provider=github`,
      },
    });

    if (error) {
      console.error("GitHub OAuth error:", error);
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
