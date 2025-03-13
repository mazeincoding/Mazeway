import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TDisable2FARequest,
  TEmptySuccessResponse,
  TSendEmailAlertRequest,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { disable2FASchema } from "@/utils/validation/auth-validation";
import { getFactorForMethod, getUser } from "@/utils/auth";
import { AUTH_CONFIG } from "@/config/auth";
import { UAParser } from "ua-parser-js";

async function sendEmailAlert(
  request: NextRequest,
  origin: string,
  user: { id: string; email: string },
  title: string,
  message: string,
  method?: string
) {
  try {
    const parser = new UAParser(request.headers.get("user-agent") || "");
    const deviceName = parser.getDevice().model || "Unknown Device";
    const browser = parser.getBrowser().name || "Unknown Browser";
    const os = parser.getOS().name || "Unknown OS";

    const body: TSendEmailAlertRequest = {
      email: user.email,
      title,
      message,
      device: {
        user_id: user.id,
        device_name: deviceName,
        browser,
        os,
        ip_address: request.headers.get("x-forwarded-for") || "::1",
      },
      ...(method ? { method } : {}),
    };

    const emailAlertResponse = await fetch(
      `${origin}/api/auth/send-email-alert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify(body),
      }
    );

    if (!emailAlertResponse.ok) {
      console.error("Failed to send 2FA disable alert", {
        status: emailAlertResponse.status,
        statusText: emailAlertResponse.statusText,
      });
    }
  } catch (error) {
    console.error("Error sending 2FA disable alert:", error);
    // Don't throw - 2FA was disabled successfully
  }
}

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

    const supabase = await createClient();
    const { user, error } = await getUser(supabase);
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 2. Get and validate request body
    const rawBody = await request.json();
    const validation = disable2FASchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TDisable2FARequest = validation.data;
    const { method, code } = body;

    // 3. Get factor ID for the method
    const factor = await getFactorForMethod(supabase, method);
    if (!factor.success || !factor.factorId) {
      return NextResponse.json(
        { error: factor.error || "2FA method not found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 4. Create challenge and verify code
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.factorId });

    if (challengeError) {
      console.error("Failed to create 2FA challenge:", challengeError);
      return NextResponse.json(
        { error: challengeError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      console.error("Failed to verify code:", verifyError);
      return NextResponse.json(
        { error: verifyError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 5. Disable the method
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.factorId,
    });

    if (unenrollError) {
      console.error("Failed to disable 2FA method:", unenrollError);
      return NextResponse.json(
        { error: unenrollError.message },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Send alert for 2FA disable if enabled
    if (
      AUTH_CONFIG.emailAlerts.twoFactor.enabled &&
      AUTH_CONFIG.emailAlerts.twoFactor.alertOnDisable
    ) {
      const methodConfig =
        AUTH_CONFIG.verificationMethods.twoFactor[
          method as keyof typeof AUTH_CONFIG.verificationMethods.twoFactor
        ];

      await sendEmailAlert(
        request,
        origin,
        user,
        "Two-factor authentication disabled",
        `${methodConfig.title} two-factor authentication was disabled on your account. If this wasn't you, please secure your account immediately.`,
        method
      );
    }

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error in 2FA disable:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
