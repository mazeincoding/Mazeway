import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { basicRateLimit, getClientIp } from "@/utils/rate-limit";
import { TApiErrorResponse } from "@/types/api";
import { getDeviceSessionId } from "@/utils/auth";

export async function POST(request: NextRequest) {
  console.log("Logout request received");
  console.log("Incoming cookies:", request.cookies.getAll());
  try {
    const { searchParams } = new URL(request.url);
    const next = searchParams.get("next");
    const message = searchParams.get("message") || "You have been logged out";

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

    // Clear Supabase session
    await supabase.auth.signOut({ scope: "local" });

    console.log("Cleared Supabase session");

    // Create response - either redirect or success JSON
    const response = next
      ? NextResponse.redirect(
          `${new URL(request.url).origin}${next}?message=${encodeURIComponent(message)}`
        )
      : NextResponse.json({ success: true });

    // Get device session ID using our utility
    const deviceSessionId = getDeviceSessionId(request);

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
