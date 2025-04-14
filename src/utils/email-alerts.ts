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
 *
 * In development, only logs the alert details.
 * In production, sends actual email alerts.
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

  // In development, just log the alert details
  if (process.env.NODE_ENV === "development") {
    console.log("[DEV] Email alert would be sent:", {
      ...body,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // In production, actually send the email
  try {
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
        type: title,
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
