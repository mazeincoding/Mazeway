import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { basicRateLimit } from "@/utils/rate-limit";

export async function POST(request: Request) {
  try {
    if (basicRateLimit) {
      const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await basicRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    const supabase = await createClient();

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
      await supabase
        .from("device_sessions")
        .delete()
        .eq("session_id", deviceSessionId);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "An error occurred while logging out." },
      { status: 500 }
    );
  }
}
