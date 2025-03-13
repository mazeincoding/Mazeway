import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  TApiErrorResponse,
  TDeleteAccountResponse,
  TEmptySuccessResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getUser,
  getDeviceSessionId,
} from "@/utils/auth";
import { AUTH_CONFIG } from "@/config/auth";

/**
 * Deletes a user account. This is a sensitive operation that requires:
 * 1. Valid authentication
 * 2. Two-factor authentication verification (if enabled)
 * 3. Proper cleanup of all user data
 */
export async function POST(request: NextRequest) {
  try {
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

    const supabase = await createClient();
    const { user, error } = await getUser(supabase);
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get device session ID
    const deviceSessionId = getDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed based on config and grace period
    const needsVerification =
      AUTH_CONFIG.requireFreshVerification.deleteAccount &&
      (await hasGracePeriodExpired(supabase, deviceSessionId));

    if (needsVerification) {
      // Get available verification methods
      const { has2FA, factors, methods } =
        await getUserVerificationMethods(supabase);

      // Return available methods for verification
      if (has2FA) {
        return NextResponse.json({
          requiresTwoFactor: true,
          availableMethods: factors,
          factorId: factors[0].factorId,
        }) satisfies NextResponse<TDeleteAccountResponse>;
      } else {
        // Return available non-2FA methods
        const availableMethods = methods.map((method) => ({
          type: method,
          factorId: method, // For non-2FA methods, use method name as factorId
        }));

        if (availableMethods.length === 0) {
          return NextResponse.json(
            { error: "No verification methods available" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        return NextResponse.json({
          requiresTwoFactor: false,
          availableMethods,
        }) satisfies NextResponse<TDeleteAccountResponse>;
      }
    }

    // User is verified within grace period, proceed with deletion
    const adminClient = await createClient({ useServiceRole: true });

    // 1. Delete backup codes first (they reference auth.users without CASCADE)
    const { error: deleteBackupCodesError } = await adminClient
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id);

    if (deleteBackupCodesError) {
      throw new Error("Failed to delete backup codes");
    }

    // 2. Delete verification codes (they reference device_sessions with CASCADE)
    const { data: existingData } = await adminClient
      .from("users")
      .select(
        `
        id,
        device_sessions (
          id,
          user_id,
          device_id
        )
      `
      )
      .eq("id", user.id)
      .single();

    const deviceSessionIds =
      existingData?.device_sessions?.map((s) => s.id) || [];
    if (deviceSessionIds.length > 0) {
      const { error: deleteVerificationError } = await adminClient
        .from("verification_codes")
        .delete()
        .in("device_session_id", deviceSessionIds);

      if (deleteVerificationError) {
        throw new Error("Failed to delete verification codes");
      }
    }

    // 3. Delete device sessions (they reference devices and users with CASCADE)
    const { error: deleteSessionsError } = await adminClient
      .from("device_sessions")
      .delete()
      .eq("user_id", user.id);

    if (deleteSessionsError) {
      throw new Error("Failed to delete device sessions");
    }

    // 4. Delete devices (they reference auth.users without CASCADE)
    const { error: deleteDevicesError } = await adminClient
      .from("devices")
      .delete()
      .eq("user_id", user.id);

    if (deleteDevicesError) {
      throw new Error("Failed to delete devices");
    }

    // 5. Delete user data (no foreign keys)
    const { error: deleteDataError } = await adminClient
      .from("users")
      .delete()
      .eq("id", user.id);

    if (deleteDataError) {
      throw new Error("Failed to delete user data");
    }

    // 6. Finally delete the auth user
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteAuthError) {
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    // Sign out the user using our existing logout route
    await fetch(`${request.nextUrl.origin}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error deleting user account:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
