import { NextRequest } from "next/server";
import { TSendEmailAlertRequest } from "@/types/api";

/**
 * Sends an email alert for security-related actions.
 * Used for stuff like:
 * - Password changes
 * - Email changes
 * - 2FA changes
 * - Device management
 * - Account deletion
 *
 * Won't throw if alert fails - logs error and continues.
 * This is because alerts shouldn't block the main action.
 */
export async function sendEmailAlert({
  request,
  origin,
  user,
  title,
  message,
  method,
  oldEmail,
  newEmail,
  revokedDevice,
  device,
}: TSendEmailAlertRequest & {
  request: NextRequest;
  origin: string;
  user: { id: string; email: string };
}) {
  try {
    const body: TSendEmailAlertRequest = {
      email: user.email,
      title,
      message,
      device,
      // Only include optional fields if they exist
      ...(method ? { method } : {}),
      ...(oldEmail && newEmail ? { oldEmail, newEmail } : {}),
      ...(revokedDevice ? { revokedDevice } : {}),
    };

    const emailAlertResponse = await fetch(
      `${origin}/api/auth/send-email-alert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify(body),
      }
    );

    if (!emailAlertResponse.ok) {
      console.error("Failed to send email alert", {
        type: title, // Log alert type for better debugging
        status: emailAlertResponse.status,
        statusText: emailAlertResponse.statusText,
      });
    }
  } catch (error) {
    console.error("Error sending email alert:", {
      type: title,
      error,
    });
    // Don't throw - the main action should continue
  }
}
