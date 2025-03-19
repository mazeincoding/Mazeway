/**
 * Server-side utilities for data export functionality
 * These functions should only be used in server code
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getDataExportStoragePath } from "./index";
import { TDataExportRequest, TDataExportStatus } from "@/types/auth";
import { verifyVerificationCode } from "@/utils/auth/verification-codes";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * Get the status of a data export request
 */
export async function getDataExportStatus(
  adminClient: SupabaseClient,
  userId: string,
  exportId: string
): Promise<TDataExportRequest | null> {
  if (typeof window !== "undefined") {
    throw new Error(
      "Getting data export status can only be done on the server"
    );
  }

  const { data, error } = await adminClient
    .from("data_export_requests")
    .select("*")
    .eq("id", exportId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Failed to get data export status:", error);
    throw new Error("Failed to get data export status");
  }

  // If no data was found, return null
  if (!data) {
    return null;
  }

  return data as TDataExportRequest;
}

/**
 * Verify a data export download token
 * Returns the export request if valid, null otherwise
 */
export async function verifyDataExportToken(
  adminClient: SupabaseClient,
  exportId: string,
  token: string
): Promise<TDataExportRequest | null> {
  if (typeof window !== "undefined") {
    throw new Error(
      "Verifying data export token can only be done on the server"
    );
  }

  // Get the export request
  const { data, error } = await adminClient
    .from("data_export_requests")
    .select("*")
    .eq("id", exportId)
    .eq("status", "completed")
    .single();

  if (error) {
    console.error("Failed to verify data export token:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Check if the token has already been used
  if (data.token_used) {
    console.log("Token has already been used:", { exportId });
    return null;
  }

  // Check if the export has expired
  if (data.completed_at) {
    const completedAt = new Date(data.completed_at);
    const expirationTime = AUTH_CONFIG.dataExport.downloadExpirationTime;
    const expiresAt = new Date(
      completedAt.getTime() + expirationTime * 60 * 60 * 1000
    );

    if (new Date() > expiresAt) {
      console.log("Export has expired:", {
        completedAt,
        expiresAt,
        now: new Date(),
      });
      return null;
    }
  }

  // Verify the token
  const isValid = await verifyVerificationCode(
    token,
    data.token_hash,
    data.salt
  );

  if (!isValid) {
    return null;
  }

  return data as TDataExportRequest;
}

/**
 * Mark a data export token as used
 * This prevents token reuse for security
 */
export async function markTokenAsUsed(
  adminClient: SupabaseClient,
  exportId: string
): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error("Marking token as used can only be done on the server");
  }

  const { error } = await adminClient
    .from("data_export_requests")
    .update({ token_used: true })
    .eq("id", exportId);

  if (error) {
    console.error("Failed to mark token as used:", error);
    // Don't throw an error here, as this is a security enhancement
    // and we don't want to fail the download if this update fails
  }
}

/**
 * Update the status of a data export request
 */
export async function updateDataExportStatus(
  adminClient: SupabaseClient,
  exportId: string,
  status: TDataExportStatus,
  error?: string
): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error(
      "Updating data export status can only be done on the server"
    );
  }

  const updates: {
    status: TDataExportStatus;
    error?: string;
    completed_at?: string;
  } = { status };

  if (error) {
    updates.error = error;
  }

  if (status === "completed" || status === "failed") {
    updates.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await adminClient
    .from("data_export_requests")
    .update(updates)
    .eq("id", exportId);

  if (updateError) {
    console.error("Failed to update data export status:", updateError);
    throw new Error("Failed to update data export status", {
      cause: updateError,
    });
  }
}

/**
 * Clean up a data export file after it has been downloaded
 * This is a security measure to prevent unauthorized access to the file
 */
export async function cleanupDataExportFile(
  adminClient: SupabaseClient,
  userId: string,
  exportId: string
): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error(
      "Cleaning up data export file can only be done on the server"
    );
  }

  const filePath = getDataExportStoragePath(userId, exportId);

  const { error } = await adminClient.storage
    .from("exports")
    .remove([filePath]);

  if (error) {
    console.error("Failed to clean up data export file:", error);
    // Don't throw an error here, as this is a cleanup operation
    // and we don't want to fail the download if cleanup fails
  }
}
