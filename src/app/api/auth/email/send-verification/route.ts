import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { Resend } from "resend";
import EmailVerificationTemplate from "@emails/templates/email-verification";
import { AUTH_CONFIG } from "@/config/auth";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { generateVerificationCode } from "@/utils/verification-codes";
import { getUser } from "@/utils/auth";

export async function POST(request: NextRequest) {
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

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Resend is not configured" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }

  try {
    const supabase = await createClient();
    const { user, error } = await getUser(supabase);
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get device session ID from cookie
    const deviceSessionId = request.cookies.get("device_session_id");
    if (!deviceSessionId?.value) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { code, hash, salt } = await generateVerificationCode({
      format: "alphanumeric",
      alphanumericLength: AUTH_CONFIG.emailVerification.codeLength,
    });

    console.log("Generated code:", code);

    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + AUTH_CONFIG.emailVerification.codeExpirationTime
    );

    // Store verification code
    const adminClient = await createClient({ useServiceRole: true });
    const { error: insertError } = await adminClient
      .from("verification_codes")
      .insert({
        device_session_id: deviceSessionId.value,
        code_hash: hash,
        salt,
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
      to: user.email!,
      subject: "Verification Code",
      react: EmailVerificationTemplate({
        code,
        expires_in: `${AUTH_CONFIG.emailVerification.codeExpirationTime} minutes`,
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
