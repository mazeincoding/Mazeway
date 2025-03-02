import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TGetDeviceSessionResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";

/**
 * Returns the current device session for the authenticated user.
 * Uses the device_session_id cookie to identify the current session.
 */
export async function GET(request: NextRequest) {
  if (apiRateLimit) {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  }

  const supabase = await createClient();

  try {
    // First security layer: Validate auth token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Get the current session ID from cookie
    const sessionId = request.cookies.get("device_session_id")?.value;
    if (!sessionId) throw new Error("No device session found");

    // Get the session data
    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found or unauthorized");
    }

    return NextResponse.json({
      data: session,
    }) satisfies NextResponse<TGetDeviceSessionResponse>;
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error &&
          (error.message === "Unauthorized" ||
            error.message === "Session not found or unauthorized" ||
            error.message === "No device session found")
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
