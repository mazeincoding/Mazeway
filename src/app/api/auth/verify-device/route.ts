import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    const { device_session_id, code } = await request.json();

    if (!device_session_id || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const supabase = await createClient();

    // Get the verification code
    const { data: verificationCode, error: codeError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("device_session_id", device_session_id)
      .eq("code", code)
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

    // Update device session
    const { error: updateError } = await supabase
      .from("device_sessions")
      .update({
        needs_verification: false,
        last_verified: new Date().toISOString(),
      })
      .eq("session_id", device_session_id);

    if (updateError) {
      console.error("Failed to update device session:", updateError);
      return NextResponse.json(
        { error: "Failed to verify device" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Delete used verification code
    await supabase
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
