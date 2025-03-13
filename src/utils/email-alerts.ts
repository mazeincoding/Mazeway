import { NextRequest } from "next/server";
import { TSendEmailAlertRequest } from "@/types/api";
import { UAParser } from "ua-parser-js";

type TSendEmailAlertOptions = {
  request: NextRequest;
  origin: string;
  user: { id: string; email: string };
  title: string;
  message: string;
  // Optional params for different alert types
  method?: string; // For 2FA alerts
  oldEmail?: string; // For email change alerts
  newEmail?: string; // For email change alerts
  revokedDevice?: {
    device_name: string;
    browser?: string;
    os?: string;
    ip_address?: string;
  };
};

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
}: TSendEmailAlertOptions) {
  try {
    const parser = new UAParser(request.headers.get("user-agent") || "");
    const deviceName = parser.getDevice().model || "Unknown Device";
    const browser = parser.getBrowser().name || "Unknown Browser";
    const os = parser.getOS().name || "Unknown OS";

    const body: TSendEmailAlertRequest = {
      email: user.email,
      title,
      message,
      device: {
        user_id: user.id,
        device_name: deviceName,
        browser,
        os,
        ip_address: request.headers.get("x-forwarded-for") || "::1",
      },
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
