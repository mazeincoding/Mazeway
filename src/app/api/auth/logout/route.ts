import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { basicRateLimit, getClientIp } from "@/utils/rate-limit";
import { TApiErrorResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    if (basicRateLimit) {
      const ip = getClientIp(request);
      const { success } = await basicRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();
    const adminClient = await createClient({ useServiceRole: true });

    // Get device session ID from cookie
    const cookieStore = request.headers.get("cookie");
    const deviceSessionId = cookieStore?.match(
      /device_session_id=([^;]+)/
    )?.[1];

    // Clear Supabase session
    await supabase.auth.signOut();

    // Create response with success status
    const response = NextResponse.json({ success: true });

    // Clear device session cookie
    response.cookies.delete("device_session_id");

    // If we had a device session, delete it from DB
    if (deviceSessionId) {
      await adminClient
        .from("device_sessions")
        .delete()
        .eq("id", deviceSessionId);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "An error occurred while logging out." },
      { status: 500 }
    );
  }
}
