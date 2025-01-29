import { createClient } from "@/utils/supabase/server";
import { TDeviceInfo } from "@/types/auth";

// Only use this function on the server
async function createDevice(device: TDeviceInfo) {
  if (typeof window !== "undefined") {
    throw new Error("Cannot create or find device on the client");
  }

  const supabase = await createClient();

  // Get user to check if they exist
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("No user found");
  }

  // Create new device
  const { data: newDevice, error: createError } = await supabase
    .from("devices")
    .insert(device)
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  return newDevice.id;
}

export type TCreateDeviceSessionParams = {
  user_id: string;
  device: TDeviceInfo;
  confidence_score: number;
  needs_verification: boolean;
  is_trusted: boolean;
};

// Only use this function on the server
export async function createDeviceSession(params: TCreateDeviceSessionParams) {
  if (typeof window !== "undefined") {
    throw new Error("Cannot create device session on the client");
  }

  const supabase = await createClient();
  const device_id = await createDevice(params.device);
  const session_id = crypto.randomUUID();

  const { error: sessionError } = await supabase
    .from("device_sessions")
    .insert({
      user_id: params.user_id,
      session_id,
      device_id,
      confidence_score: params.confidence_score,
      needs_verification: params.needs_verification,
      is_trusted: params.is_trusted,
    });

  if (sessionError) {
    throw sessionError;
  }

  return session_id;
}
