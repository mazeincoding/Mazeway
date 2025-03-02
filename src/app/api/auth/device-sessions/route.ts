import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TGetDeviceSessionsResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data,
    }) satisfies NextResponse<TGetDeviceSessionsResponse>;
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
