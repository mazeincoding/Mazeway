import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TApiErrorResponse, TGetUserResponse } from "@/types/api";
import type {
  TTwoFactorMethod,
  TUserWithAuth,
  TSocialProvider,
} from "@/types/auth";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { getUserVerificationMethods } from "@/utils/auth";

export async function GET(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = getClientIp(request);
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get user profile from database
    const { data: userData, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profileError) {
      console.error("Failed to fetch user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get MFA factors
    const { data: mfaData } = await supabase.auth.mfa.listFactors();

    // Get enabled 2FA methods
    const enabled2faMethods: TTwoFactorMethod[] =
      mfaData?.all
        ?.filter((factor) => factor.status === "verified")
        .map((factor) =>
          factor.factor_type === "totp" ? "authenticator" : "sms"
        ) || [];

    // Get available verification methods
    const { methods: availableVerificationMethods } =
      await getUserVerificationMethods(supabase);

    // Combine user data
    const userWithAuth: TUserWithAuth = {
      ...userData,
      auth: {
        emailVerified: !!authUser.email_confirmed_at,
        lastSignInAt: authUser.last_sign_in_at,
        twoFactorEnabled: enabled2faMethods.length > 0,
        enabled2faMethods,
        availableVerificationMethods,
        identities:
          authUser.identities?.map((i) => i.provider as TSocialProvider) || [],
      },
    };

    return NextResponse.json({
      user: userWithAuth,
    }) satisfies NextResponse<TGetUserResponse>;
  } catch (error) {
    console.error("Error in get user:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
