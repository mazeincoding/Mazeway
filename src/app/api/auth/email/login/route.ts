import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  TApiErrorResponse,
  TEmailLoginRequest,
  TEmailLoginResponse,
} from "@/types/api";
import { getUserVerificationMethods } from "@/utils/auth";
import { authSchema } from "@/validation/auth-validation";

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
    const redirectUrl = `${origin}/api/auth/post-auth?provider=email&next=/`;

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = authSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TEmailLoginRequest = validation.data;

    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError) {
      // Generic error message for any auth failure
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    try {
      // Check if user has 2FA enabled
      const { has2FA, methods, factors } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      if (has2FA) {
        // Get first available 2FA method and its factor
        const factor = factors.find((f) => methods.includes(f.type));
        if (!factor) {
          throw new Error("No valid 2FA methods found");
        }

        return NextResponse.json({
          requiresTwoFactor: true,
          availableMethods: factors,
          redirectTo: redirectUrl,
        }) satisfies NextResponse<TEmailLoginResponse>;
      }
    } catch (error) {
      console.error("Error checking 2FA status:", error);
      return NextResponse.json(
        { error: "Failed to check 2FA status" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // If no 2FA required or not configured, proceed with login
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
