import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TGetTrustedDeviceSessionsResponse,
} from "@/types/api";

/**
 * Returns all trusted device sessions for the authenticated user.
 * A session is considered trusted if it has been explicitly marked as trusted
 * during session creation based on device confidence and verification status.
 */
export async function GET() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_trusted", true)
      .order("last_active", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data,
    }) satisfies NextResponse<TGetTrustedDeviceSessionsResponse>;
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
