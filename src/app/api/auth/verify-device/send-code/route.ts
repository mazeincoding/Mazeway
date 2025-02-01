import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { Resend } from "resend";
import DeviceVerificationEmail from "@emails/templates/device-verification";
import { randomBytes } from "crypto";
import type { TDeviceSession, TUser } from "@/types/auth";
import { AUTH_CONFIG } from "@/config/auth";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";

function generateVerificationCode(): string {
  const codeLength = AUTH_CONFIG.deviceVerification.codeLength;
  return randomBytes(Math.ceil(codeLength / 2))
    .readUIntBE(0, Math.ceil(codeLength / 2))
    .toString()
    .padStart(codeLength, "0")
    .slice(-codeLength);
}

export async function POST(request: NextRequest) {
  if (authRateLimit) {
    const ip = getClientIp(request);
    const { success } = await authRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }

  try {
    const { device_session_id, device_name } = await request.json();

    if (!device_session_id || !device_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();

    // Get device session to verify ownership and get user email
    const { data: deviceSession, error: sessionError } = await supabase
      .from("device_sessions")
      .select(
        `
        user_id,
        user:users!inner (
          email
        )
      `
      )
      .eq("session_id", device_session_id)
      .single<TDeviceSession & { user: Pick<TUser, "email"> }>();

    if (sessionError || !deviceSession?.user?.email) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 404 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const code = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + AUTH_CONFIG.deviceVerification.codeExpirationTime
    );

    // Store verification code
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        device_session_id,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Failed to store verification code:", insertError);
      return NextResponse.json(
        { error: "Failed to generate verification code" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Send email with code
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: deviceSession.user.email,
      subject: "Verify your device",
      react: DeviceVerificationEmail({
        code,
        device_name,
        expires_in: `${AUTH_CONFIG.deviceVerification.codeExpirationTime} minutes`,
      }),
    });

    return NextResponse.json(
      {},
      { status: 200 }
    ) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error sending verification code:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
