import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { verifyVerificationCode } from "@/utils/auth/verification-codes";
import { logAccountEvent } from "@/utils/account-events/server";
import { UAParser } from "ua-parser-js";

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

    const { device_session_id, code } = await request.json();

    if (!device_session_id || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const adminClient = await createClient({ useServiceRole: true });

    // Get device session first to get user_id
    const { data: deviceSession, error: sessionError } = await adminClient
      .from("device_sessions")
      .select("user_id")
      .eq("id", device_session_id)
      .single();

    if (sessionError || !deviceSession) {
      return NextResponse.json(
        { error: "Invalid device session" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the verification code
    const { data: verificationCode, error: codeError } = await adminClient
      .from("verification_codes")
      .select("*")
      .eq("device_session_id", device_session_id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (codeError || !verificationCode) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Verify the code hash
    const isValid = await verifyVerificationCode(
      code,
      verificationCode.code_hash,
      verificationCode.salt
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Update device session
    const { error: updateError } = await adminClient
      .from("device_sessions")
      .update({
        needs_verification: false,
        device_verified_at: new Date().toISOString(),
      })
      .eq("id", device_session_id);

    if (updateError) {
      console.error("Failed to update device session:", updateError);
      return NextResponse.json(
        { error: "Failed to verify device" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Log the device verification event
    const parser = new UAParser(request.headers.get("user-agent") || "");
    await logAccountEvent({
      user_id: deviceSession.user_id,
      event_type: "DEVICE_VERIFIED",
      device_session_id,
      metadata: {
        device: {
          device_name: parser.getDevice().model || "Unknown Device",
          browser: parser.getBrowser().name || null,
          os: parser.getOS().name || null,
          ip_address: getClientIp(request),
        },
      },
    });

    // Delete used verification code
    await adminClient
      .from("verification_codes")
      .delete()
      .eq("id", verificationCode.id)
      .throwOnError();

    return NextResponse.json(
      {},
      { status: 200 }
    ) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error verifying device:", error);
    return NextResponse.json(
      { error: "Failed to verify device" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
