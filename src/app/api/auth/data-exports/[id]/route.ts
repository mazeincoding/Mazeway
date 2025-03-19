/**
 * Gets the status of an export request
 */

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/utils/auth";
import { getDataExportStatus } from "@/utils/data-export/server";
import { TApiErrorResponse, TGetDataExportStatusResponse } from "@/types/api";
import { AUTH_CONFIG } from "@/config/auth";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Check if data exports are enabled
    if (!AUTH_CONFIG.dataExport.enabled) {
      return NextResponse.json(
        { error: "Data exports are not enabled" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Apply rate limiting
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Get the user
    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { user, error } = await getUser({ supabase });

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the export ID from the URL
    const pathParts = request.nextUrl.pathname.split("/");
    const exportId = pathParts[pathParts.length - 1]; // Last segment for status route

    if (!exportId) {
      return NextResponse.json(
        { error: "Missing export ID" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the export status
    const exportRequest = await getDataExportStatus(
      supabaseAdmin,
      user.id,
      exportId
    );

    if (!exportRequest) {
      return NextResponse.json(
        { error: "Export request not found" },
        { status: 404 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Return the status
    return NextResponse.json({
      id: exportRequest.id,
      status: exportRequest.status,
      created_at: exportRequest.created_at,
      completed_at: exportRequest.completed_at,
    }) satisfies NextResponse<TGetDataExportStatusResponse>;
  } catch (error) {
    console.error("Error getting data export status:", error);
    return NextResponse.json(
      { error: "Failed to get data export status" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
