import { AUTH_CONFIG } from "@/config/auth";
import { TDataExportEventPayload } from "@/types/auth";
import { getDataExportStoragePath } from "@/utils/data-export";
import { updateDataExportStatus } from "@/utils/data-export/server";
import { createClient } from "@/utils/supabase/server";
import DataExportReadyTemplate from "@emails/templates/data-export-ready";
import { logger, task } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";

export const exportUserDataTask = task({
  id: "export-user-data",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 600, // Stop executing after 600 secs (10 mins) of compute
  run: async (payload: TDataExportEventPayload) => {
    const { userId, exportId, token } = payload;

    const resend = process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : null;

    try {
      // Update status to processing
      await updateDataExportStatus(exportId, "processing");

      const adminClient = await createClient({ useServiceRole: true });

      // Get user data
      const { data: userData, error: userError } = await adminClient
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        logger.error("Failed to get user data", {
          userId,
          error: userError,
        });
        throw new Error("Failed to get user data", { cause: userError });
      }

      // Get user's account events
      const { data: events, error: eventsError } = await adminClient
        .from("account_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (eventsError) {
        logger.error("Failed to get account events", {
          userId,
          error: eventsError,
        });
        throw new Error("Failed to get account events", { cause: eventsError });
      }

      // Get user's device sessions
      const { data: devices, error: devicesError } = await adminClient
        .from("devices")
        .select("*")
        .eq("user_id", userId);

      if (devicesError) {
        logger.error("Failed to get device sessions", {
          userId,
          error: devicesError,
        });
        throw new Error("Failed to get device sessions", {
          cause: devicesError,
        });
      }

      // Compile all data
      const exportData = {
        user: userData,
        events: events || [],
        devices: devices || [],
        exported_at: new Date().toISOString(),
      };

      // Upload to Supabase Storage
      const filePath = getDataExportStoragePath(userId, exportId);
      const { error: uploadError } = await adminClient.storage
        .from("exports")
        .upload(filePath, JSON.stringify(exportData, null, 2), {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadError) {
        logger.error("Failed to upload export file", {
          userId,
          error: uploadError,
        });
        throw new Error("Failed to upload export file", {
          cause: uploadError,
        });
      }

      // Create download URL with token
      const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/data-exports/${exportId}/download?token=${token}`;

      // Send email with download link
      if (resend && userData.email) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: userData.email,
            subject: "Your data export is ready",
            react: DataExportReadyTemplate({
              email: userData.email,
              downloadUrl,
              expiresInHours: AUTH_CONFIG.dataExport.downloadExpirationTime,
            }),
          });
        } catch (emailError) {
          console.error("Failed to send data export ready email:", emailError);
          // Don't fail the export if email sending fails
        }
      }

      // Update status to completed
      await updateDataExportStatus(exportId, "completed");
    } catch (error) {
      // Update status to failed with error message
      await updateDataExportStatus(
        exportId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );

      throw error;
    }
  },
});
