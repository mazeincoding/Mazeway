import { createClient } from "@/utils/supabase/server";
import { TDeviceInfo, TDeviceSession, TUserWithAuth } from "@/types/auth";
import { AUTH_CONFIG } from "@/config/auth";
import { logAccountEvent } from "@/utils/account-events/server";
import { getUser } from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { NextRequest } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Gets the current device session based on the request cookie, verifies its validity.
 * This function MUST run on the server.
 *
 * @param request The NextRequest object
 * @param supabase Supabase client instance
 * @param user The authenticated user
 * @returns Promise<{ deviceSession: TDeviceSession | null; isValid: boolean; error: Error | null }> Result object
 */
export async function getCurrentDeviceSession({
  request,
  supabase,
  user,
}: {
  request: NextRequest;
  supabase: SupabaseClient;
  user: TUserWithAuth | null;
}): Promise<{
  deviceSession: TDeviceSession | null;
  isValid: boolean;
  error: Error | null;
}> {
  try {
    // Get session ID from cookies using the shared utility
    const currentSessionId = getCurrentDeviceSessionId(request);
    if (!currentSessionId) {
      return {
        deviceSession: null,
        isValid: false,
        error: new Error("No device session ID found in request cookies."),
      };
    }

    if (!user) {
      return {
        deviceSession: null,
        isValid: false,
        error: new Error("No user found."),
      };
    }

    // Fetch the session, ensuring it belongs to the user and hasn't expired
    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("id", currentSessionId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.error("Failed to fetch or validate current device session", {
        error: sessionError,
        sessionId: currentSessionId,
        userId: user.id,
      });
      return {
        deviceSession: null,
        isValid: false,
        error:
          sessionError ||
          new Error("Device session not found, expired, or unauthorized."),
      };
    }

    // Type assertion might be needed depending on your TDeviceSession definition
    const typedSession = session as unknown as TDeviceSession;

    return { deviceSession: typedSession, isValid: true, error: null };
  } catch (err) {
    console.error("[getCurrentDeviceSession] Unexpected error:", err);
    return {
      deviceSession: null,
      isValid: false,
      error:
        err instanceof Error
          ? err
          : new Error(
              "An unexpected error occurred while fetching the device session."
            ),
    };
  }
}
