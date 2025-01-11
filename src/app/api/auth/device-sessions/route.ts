import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TCreateDeviceSessionRequest,
  TEmptySuccessResponse,
  TGetDeviceSessionsResponse,
} from "@/types/api";
import { TDeviceInfo } from "@/types/auth";

async function createOrFindDevice(device: TDeviceInfo) {
  const supabase = await createClient();

  // Try to find existing device
  const { data: existingDevice } = await supabase
    .from("devices")
    .select("id")
    .eq("device_name", device.device_name)
    .eq("browser", device.browser)
    .eq("os", device.os)
    .single();

  if (existingDevice) {
    return existingDevice.id;
  }

  // Create new device if not found
  const { data: newDevice, error } = await supabase
    .from("devices")
    .insert(device)
    .select("id")
    .single();

  if (error) throw error;
  return newDevice.id;
}

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
      .order("last_active", { ascending: false });

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

export async function POST(request: NextRequest) {
  const supabase = await createClient({ useServiceRole: true });

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const data: TCreateDeviceSessionRequest = await request.json();

    // Validate that the user_id matches the authenticated user
    if (data.user_id !== user.id) {
      throw new Error("Unauthorized: Cannot create sessions for other users");
    }

    // First create or find the device
    const device_id = await createOrFindDevice(data.device);

    // Then create the session with security context
    const { error } = await supabase.from("device_sessions").insert({
      user_id: data.user_id,
      session_id: data.session_id,
      device_id,
      confidence_score: data.confidence_score,
      needs_verification: data.needs_verification,
      is_trusted: data.is_trusted,
    });

    if (error) throw error;

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
