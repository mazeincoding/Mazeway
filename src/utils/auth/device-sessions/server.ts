import { createClient } from "@/utils/supabase/server";
import { TDeviceInfo } from "@/types/auth";
import { AUTH_CONFIG } from "@/config/auth";
import { logAccountEvent } from "@/utils/account-events/server";
import { getUser } from "@/utils/auth";

// Function to get the current device session ID

async function createDevice({ device }: { device: TDeviceInfo }) {
  if (typeof window !== "undefined") {
    throw new Error("Creating a device can only be done on the server");
  }

  const supabase = await createClient();

  // Get user to check if they exist
  const { user, error: userError } = await getUser({ supabase });
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

export interface TCreateDeviceSessionParams {
  user_id: string;
  device: TDeviceInfo;
  confidence_score: number;
  needs_verification: boolean;
  is_trusted: boolean;
}

// Only use this function on the server
export async function createDeviceSession(params: TCreateDeviceSessionParams) {
  if (typeof window !== "undefined") {
    throw new Error("Creating a device session can only be done on the server");
  }

  const adminClient = await createClient({ useServiceRole: true });
  const device_id = await createDevice({ device: params.device });

  // Log new device login event
  await logAccountEvent({
    user_id: params.user_id,
    event_type: "NEW_DEVICE_LOGIN",
    metadata: {
      device: {
        device_name: params.device.device_name,
        browser: params.device.browser,
        os: params.device.os,
        ip_address: params.device.ip_address,
      },
      category: "warning",
      description: `New login detected from ${params.device.browser || "unknown browser"} on ${params.device.os || "unknown OS"}`,
    },
  });

  // Calculate expiration date
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + AUTH_CONFIG.deviceSessions.maxAge);

  const { data: session, error: sessionError } = await adminClient
    .from("device_sessions")
    .insert({
      user_id: params.user_id,
      device_id,
      confidence_score: params.confidence_score,
      needs_verification: params.needs_verification,
      is_trusted: params.is_trusted,
      expires_at: expires_at.toISOString(),
    })
    .select("id")
    .single();

  if (sessionError) {
    throw sessionError;
  }

  // Log auto-trust event if device was trusted
  if (params.is_trusted) {
    await logAccountEvent({
      user_id: params.user_id,
      event_type: "DEVICE_TRUSTED_AUTO",
      device_session_id: session.id,
      metadata: {
        device: {
          device_name: params.device.device_name,
          browser: params.device.browser,
          os: params.device.os,
          ip_address: params.device.ip_address,
        },
        reason: params.confidence_score === 100 ? "new_account" : "oauth",
        category: "success",
        description: `Device automatically trusted (${params.confidence_score === 100 ? "new account" : "OAuth login"})`,
      },
    });
  }

  return session.id;
}
