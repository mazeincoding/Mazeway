import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  verifyDataExportToken,
  cleanupDataExportFile,
  markTokenAsUsed,
} from "@/utils/data-export/server";
import { getDataExportStoragePath } from "@/utils/data-export/index";
import { validateDataExportToken } from "@/validation/auth-validation";
import { TApiErrorResponse } from "@/types/api";
import { AUTH_CONFIG } from "@/config/auth";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Check if data exports are enabled
    if (!AUTH_CONFIG.dataExport.enabled) {
      console.log("Data exports are not enabled");
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

    // Get the export ID from the URL
    const pathParts = request.nextUrl.pathname.split("/");
    const exportId = pathParts[pathParts.length - 2]; // Second to last segment

    if (!exportId) {
      console.log("Missing export ID in URL");
      return NextResponse.json(
        { error: "Missing export ID" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the token from the query string
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Validate the token format
    const { isValid, error } = validateDataExportToken(token);

    if (!isValid) {
      console.log("Invalid token format:", error);
      return NextResponse.json(
        { error: error || "Invalid token format" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the file from storage
    const adminClient = await createClient({ useServiceRole: true });

    // Verify the token
    const exportRequest = await verifyDataExportToken(
      adminClient,
      exportId,
      token
    );

    if (!exportRequest) {
      console.log("Token verification failed");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the file from storage
    const fullPath = getDataExportStoragePath(exportRequest.user_id, exportId);
    // Remove the bucket name from the path since it's specified in .from()
    const filePath = fullPath.replace(/^exports\//, "");

    const { data, error: downloadError } = await adminClient.storage
      .from("exports")
      .download(filePath);

    if (downloadError || !data) {
      console.error("Download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to download export file" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Mark token as used and clean up file
    await markTokenAsUsed(adminClient, exportId);

    // Clean up the file after successful download
    cleanupDataExportFile({
      adminClient,
      userId: exportRequest.user_id,
      exportId,
    }).catch((error) => {
      console.error("Error cleaning up export file:", error);
    });

    // Return the file
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set(
      "Content-Disposition",
      `attachment; filename="data-export-${exportId}.json"`
    );

    return new NextResponse(data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to download export file" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
