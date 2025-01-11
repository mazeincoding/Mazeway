import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Get device session ID from cookie
  const cookieStore = request.headers.get("cookie");
  const deviceSessionId = cookieStore?.match(/device_session_id=([^;]+)/)?.[1];

  // Clear Supabase session
  await supabase.auth.signOut();

  // Create response
  const response = NextResponse.redirect(new URL("/auth/login", request.url));

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
}
