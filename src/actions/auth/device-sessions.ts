"use server";

import {
  TAccessLevel,
  TDeviceInfo,
  TDeviceSession,
  TVerificationLevel,
} from "@/types/auth";
import { createClient } from "@/utils/supabase/server";

async function createOrFindDevice(device: TDeviceInfo) {
  const supabase = await createClient({ useServiceRole: true });

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

export async function createDeviceSession(data: {
  user_id: string;
  session_id: string;
  device: TDeviceInfo;
  security: {
    accessLevel: TAccessLevel;
    verificationLevel: TVerificationLevel;
    confidenceScore: number;
    needsVerification: boolean;
  };
}): Promise<{ error?: string }> {
  const supabase = await createClient({ useServiceRole: true });

  try {
    // First create or find the device
    const device_id = await createOrFindDevice(data.device);

    // Then create the session with security context
    const { error } = await supabase.from("device_sessions").insert({
      user_id: data.user_id,
      session_id: data.session_id,
      device_id,
      access_level: data.security.accessLevel,
      verification_level: data.security.verificationLevel,
      confidence_score: data.security.confidenceScore,
      needs_verification: data.security.needsVerification,
    });

    if (error) throw error;
    return {};
  } catch (error: any) {
    console.error("Error creating device session:", error);
    return { error: error.message };
  }
}

export async function deleteDeviceSession(
  sessionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient({ useServiceRole: true });

  try {
    // First revoke the auth session
    const { error: signOutError } =
      await supabase.auth.admin.signOut(sessionId);
    if (signOutError) throw signOutError;

    // Then delete our device session record
    const { error: deleteError } = await supabase
      .from("device_sessions")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) throw deleteError;
    return {};
  } catch (error: any) {
    console.error("Error deleting device session:", error);
    return { error: error.message };
  }
}

export async function getDeviceSessions(
  userId: string
): Promise<{ data: TDeviceSession[] | null; error?: string }> {
  const supabase = await createClient({ useServiceRole: true });

  try {
    const { data, error } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("last_active", { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error: any) {
    console.error("Error fetching device sessions:", error);
    return { data: null, error: error.message };
  }
}
