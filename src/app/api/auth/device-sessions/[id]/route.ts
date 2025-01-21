import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TEmptySuccessResponse } from "@/types/api";
import { apiRateLimit } from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * Deletes a device session. Security is enforced through two layers:
 * 1. Validates the auth token via getUser() to ensure the request is authenticated
 * 2. Verifies the authenticated user owns the device session they're trying to delete
 *
 * This double-check prevents authenticated users from deleting sessions belonging
 * to other users, even if they have a valid token.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (apiRateLimit && AUTH_CONFIG.api_rate_limit.enabled) {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
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

    // Second security layer: Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select("session_id")
      .eq("session_id", params.id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found or unauthorized");
    }

    // Delete the device session
    const { error: deleteError } = await supabase
      .from("device_sessions")
      .delete()
      .eq("session_id", params.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error &&
          (error.message === "Unauthorized" ||
            error.message === "Session not found or unauthorized")
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
