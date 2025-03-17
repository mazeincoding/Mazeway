import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUser, getDeviceSessionId } from "@/utils/auth";
import { logAccountEvent } from "@/utils/account-events/server";
import { dataExportRateLimit, getClientIp } from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";
import {
  TApiErrorResponse,
  TCreateDataExportResponse,
  TGetDataExportsResponse,
} from "@/types/api";
import { UAParser } from "ua-parser-js";
import { render } from "@react-email/render";
import { Resend } from "resend";
import DataExportRequestedTemplate from "@emails/templates/data-export-requested";
import { TDeviceInfo, TDataExportRequest } from "@/types/auth";
import { hashVerificationCode } from "@/utils/auth/verification-codes";
import { randomBytes } from "crypto";
import { configure, tasks } from "@trigger.dev/sdk/v3";
import type { exportUserDataTask } from "@/trigger/user-data-exports";

configure({
  accessToken: process.env.TRIGGER_API_KEY,
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Type for creating a new data export request
// Omit auto-generated fields and optional fields that aren't needed on creation
type TCreateDataExportRequestData = Pick<
  TDataExportRequest,
  "user_id" | "status" | "token_hash" | "salt"
>;

export async function POST(
  request: NextRequest
): Promise<NextResponse<TCreateDataExportResponse | TApiErrorResponse>> {
  try {
    // Check if data exports are enabled
    if (!AUTH_CONFIG.dataExport.enabled) {
      return NextResponse.json(
        { error: "Data exports are not enabled" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Apply rate limiting
    if (dataExportRateLimit) {
      const ip = getClientIp(request);
      const { success } = await dataExportRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Get the user and device session
    const supabase = await createClient();
    const { user, error } = await getUser({ supabase });

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get device info for logging
    const deviceSessionId = getDeviceSessionId(request);
    const userAgent = request.headers.get("user-agent") || "";
    const parser = new UAParser(userAgent);
    const deviceInfo: TDeviceInfo = {
      user_id: user.id,
      device_name:
        parser.getDevice().model || parser.getOS().name || "Unknown device",
      browser: parser.getBrowser().name || null,
      os: parser.getOS().name || null,
      ip_address: getClientIp(request),
    };

    // Create the data export request
    const token = randomBytes(32).toString("hex");
    const { hash, salt } = await hashVerificationCode(token);

    const adminClient = await createClient({ useServiceRole: true });

    const exportRequestData: TCreateDataExportRequestData = {
      user_id: user.id,
      status: "pending",
      token_hash: hash,
      salt,
    };

    const { data, error: exportError } = await adminClient
      .from("data_export_requests")
      .insert(exportRequestData)
      .select("id")
      .single();

    if (exportError) {
      console.error("Failed to create data export request:", exportError);
      throw new Error("Failed to create data export request");
    }

    // Log the event
    await logAccountEvent({
      user_id: user.id,
      device_session_id: deviceSessionId || undefined,
      event_type: "DATA_EXPORT_REQUESTED",
      metadata: {
        device: {
          device_name: deviceInfo.device_name,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip_address: deviceInfo.ip_address,
        },
      },
    });

    // Send email notification
    if (resend) {
      try {
        const emailHtml = render(
          DataExportRequestedTemplate({
            email: user.email,
            device: deviceInfo,
          })
        );

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "auth@example.com",
          to: user.email,
          subject: "Data export request received",
          html: await emailHtml,
        });
      } catch (emailError) {
        console.error("Failed to send data export request email:", emailError);
        // Don't fail the request if email sending fails
      }
    }

    // Trigger the background task
    if (process.env.TRIGGER_API_KEY) {
      await tasks.trigger<typeof exportUserDataTask>(
        "export-user-data",
        {
          userId: user.id,
          exportId: data.id,
          token,
        },
        {
          maxAttempts: 3,
        }
      );
    } else {
      console.warn(
        "TRIGGER_API_KEY not set - data export will not be processed"
      );
    }

    return NextResponse.json({
      id: data.id,
      status: "pending",
    }) satisfies NextResponse<TCreateDataExportResponse>;
  } catch (error) {
    console.error("Error creating data export request:", error);
    return NextResponse.json(
      { error: "Failed to create data export request" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}

// Add GET handler to fetch previous exports
export async function GET(): Promise<
  NextResponse<TGetDataExportsResponse | TApiErrorResponse>
> {
  try {
    // Check if data exports are enabled
    if (!AUTH_CONFIG.dataExport.enabled) {
      return NextResponse.json(
        { error: "Data exports are not enabled" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the user
    const supabase = await createClient();
    const { user, error } = await getUser({ supabase });

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get previous exports
    const adminClient = await createClient({ useServiceRole: true });
    const { data: exports, error: exportsError } = await adminClient
      .from("data_export_requests")
      .select("id, status, created_at, completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10); // Limit to last 10 exports

    if (exportsError) {
      console.error("Failed to get data exports:", exportsError);
      return NextResponse.json(
        { error: "Failed to get data exports" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({
      exports,
    }) satisfies NextResponse<TGetDataExportsResponse>;
  } catch (error) {
    console.error("Error getting data exports:", error);
    return NextResponse.json(
      { error: "Failed to get data exports" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
