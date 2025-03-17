import { createClient } from "@/utils/supabase/server";
import { TDeviceInfo, TDeviceSessionOptions } from "@/types/auth";
import { UAParser } from "ua-parser-js";
import { AUTH_CONFIG } from "@/config/auth";
import { logAccountEvent } from "@/utils/account-events/server";
import { getUser } from "@/utils/auth";

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

export type TCreateDeviceSessionParams = {
  user_id: string;
  device: TDeviceInfo;
  confidence_score: number;
  needs_verification: boolean;
  is_trusted: boolean;
};

/**
 * Creates a device session with proper trust and verification settings based on the auth flow
 * @param request The incoming request object
 * @param user_id The ID of the user to create the session for
 * @param options Configuration options for the session
 * @returns The created session ID
 */
export async function setupDeviceSession({
  request,
  user_id,
  options,
}: {
  request: Request;
  user_id: string;
  options: TDeviceSessionOptions;
}): Promise<string> {
  // Parse user agent for device info
  const parser = new UAParser(request.headers.get("user-agent") || "");
  const currentDevice: TDeviceInfo = {
    user_id,
    device_name: parser.getDevice().model || "Unknown Device",
    browser: parser.getBrowser().name || "Unknown Browser",
    os: parser.getOS().name || "Unknown OS",
    ip_address: request.headers.get("x-forwarded-for") || "::1",
  };

  // Calculate confidence and verification needs based on trust level
  let confidence_score: number;
  let needs_verification: boolean;
  let is_trusted: boolean;

  // First-time signup device should be trusted
  if (options.isNewUser) {
    // This is the device that created the account, so we trust it
    confidence_score = 100;
    needs_verification = false;
    is_trusted = true;
  } else {
    // For existing users, use the standard trust levels
    switch (options.trustLevel) {
      case "high":
        // High trust for password reset, email verification, etc.
        confidence_score = 100;
        needs_verification = false;
        is_trusted = true;
        break;
      case "oauth":
        // OAuth providers are generally trusted
        confidence_score = 85;
        needs_verification = false;
        is_trusted = true;
        break;
      case "normal":
        // Regular email/password login
        confidence_score = 70;
        needs_verification = !options.skipVerification;
        is_trusted = false;
        break;
    }
  }

  // Create the session
  const session_id = await createDeviceSession({
    user_id,
    device: currentDevice,
    confidence_score,
    needs_verification,
    is_trusted,
  });

  return session_id;
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
      },
    });
  }

  return session.id;
}
