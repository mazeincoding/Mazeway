import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  TApiErrorResponse,
  TDeleteAccountResponse,
  TEmptySuccessResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { checkTwoFactorRequirements, verifyTwoFactorCode } from "@/utils/auth";
import { twoFactorVerificationSchema } from "@/utils/validation/auth-validation";
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

    // First security layer: Validate auth token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get user data including has_password
    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("has_password")
      .eq("id", user.id)
      .single();

    if (dbError || !dbUser) {
      return NextResponse.json(
        { error: "Failed to get user data" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if body exists for 2FA verification
    const body = await request.json().catch(() => null);

    // Check if 2FA verification is needed
    if (AUTH_CONFIG.twoFactorAuth.enabled) {
      const twoFactorCheck = await checkTwoFactorRequirements(supabase);

      // If user has 2FA enabled but no verification provided
      if (twoFactorCheck.requiresTwoFactor) {
        if (!body) {
          return NextResponse.json(
            {
              requiresTwoFactor: true,
              availableMethods: twoFactorCheck.availableMethods,
              factorId: twoFactorCheck.factorId,
            },
            { status: 428 }
          ) satisfies NextResponse<TDeleteAccountResponse>;
        }

        // Validate and verify 2FA only if it's required
        const validation = twoFactorVerificationSchema.safeParse(body);

        if (!validation.success) {
          return NextResponse.json(
            { error: "Invalid 2FA verification data" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        const { factorId, code } = validation.data;

        try {
          // Verify 2FA code
          await verifyTwoFactorCode(supabase, factorId, code);
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to verify code",
            },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }
      }
    }

    // Create service role client for deletion
    const adminClient = await createClient({ useServiceRole: true });

    // 1. Delete verification codes first (they reference device_sessions)
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

    // 2. Delete device sessions (they reference devices and users)
    const { error: deleteSessionsError } = await adminClient
      .from("device_sessions")
      .delete()
      .eq("user_id", user.id);

    if (deleteSessionsError) {
      throw new Error("Failed to delete device sessions");
    }

    // 3. Delete devices (they reference auth.users)
    const { error: deleteDevicesError } = await adminClient
      .from("devices")
      .delete()
      .eq("user_id", user.id);

    if (deleteDevicesError) {
      throw new Error("Failed to delete devices");
    }

    // 4. Delete user data (references auth.users through RLS)
    const { error: deleteDataError } = await adminClient
      .from("users")
      .delete()
      .eq("id", user.id);

    if (deleteDataError) {
      throw new Error("Failed to delete user data");
    }

    // 5. Finally delete the auth user
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteAuthError) {
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    // Clear all cookies
    const response = NextResponse.json(
      {}
    ) satisfies NextResponse<TEmptySuccessResponse>;
    response.cookies.delete("device_session_id");

    return response;
  } catch (error) {
    console.error("Error deleting user account:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
