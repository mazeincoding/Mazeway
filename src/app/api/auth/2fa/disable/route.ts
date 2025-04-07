import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TDisable2FARequest,
  TDisable2FAResponse,
  TEmptySuccessResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { disable2FASchema } from "@/validation/auth-validation";
import {
  getFactorForMethod,
  getUser,
  getUserVerificationMethods,
  hasGracePeriodExpired,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { UAParser } from "ua-parser-js";
import { TDeviceInfo } from "@/types/auth";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  let deviceInfo: TDeviceInfo | null = null;

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
    const supabaseAdmin = await createClient({ useServiceRole: true });
    const { user, error } = await getUser({ supabase });
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get device session ID
    const deviceSessionId = getCurrentDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Parse user agent to get device info
    const parser = new UAParser(request.headers.get("user-agent") || "");
    deviceInfo = {
      user_id: user.id,
      device_name: parser.getDevice().model || "Unknown Device",
      browser: parser.getBrowser().name || null,
      os: parser.getOS().name || null,
      ip_address: getClientIp(request),
    };

    // 2. Get and validate request body
    const rawBody = await request.json();
    const validation = disable2FASchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TDisable2FARequest = validation.data;
    const { method, checkVerificationOnly = false } = body;

    // 3. Get factor ID for the method
    const factor = await getFactorForMethod({ supabase, method });
    if (!factor.success || !factor.factorId) {
      return NextResponse.json(
        { error: factor.error || "2FA method not found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed based on grace period
    const needsVerification = await hasGracePeriodExpired({
      deviceSessionId,
      supabase,
    });

    if (needsVerification) {
      // Get available verification methods
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      // Return available methods for verification
      if (has2FA) {
        // If we're just checking, return the methods
        if (checkVerificationOnly) {
          return NextResponse.json({
            requiresVerification: true,
            availableMethods: factors,
          }) satisfies NextResponse<TDisable2FAResponse>;
        }
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

        // If we're just checking, return the methods
        if (checkVerificationOnly) {
          return NextResponse.json({
            requiresVerification: true,
            availableMethods,
          }) satisfies NextResponse<TDisable2FAResponse>;
        }
      }
    } else {
      // No verification needed
      if (checkVerificationOnly) {
        return NextResponse.json({
          requiresVerification: false,
        }) satisfies NextResponse<TDisable2FAResponse>;
      }
    }

    // If we're just checking requirements, we've already returned.
    // If we get here, we're actually performing the disable operation.

    // Log sensitive action verification if it didn't need verification
    if (!needsVerification) {
      await logAccountEvent({
        user_id: user.id,
        event_type: "SENSITIVE_ACTION_VERIFIED",
        device_session_id: deviceSessionId,
        metadata: {
          device: deviceInfo,
          action: "disable_2fa",
          category: "warning",
          description: `2FA disabling (${method}) verified via grace period`,
        },
      });
    }

    // 5. Disable the method
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.factorId,
    });

    if (unenrollError) {
      console.error("Failed to disable 2FA method:", unenrollError);
      return NextResponse.json(
        { error: unenrollError.message },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Delete all backup codes for the user since 2FA is now disabled
    const { error: backupCodesDeleteError } = await supabaseAdmin
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id);

    if (backupCodesDeleteError) {
      console.error("Failed to delete backup codes:", backupCodesDeleteError);
      // Log the error but don't fail the request since 2FA was successfully disabled
    }

    // Update has_backup_codes flag to false since we deleted all backup codes
    const { error: userUpdateError } = await supabaseAdmin
      .from("users")
      .update({ has_backup_codes: false })
      .eq("id", user.id);

    if (userUpdateError) {
      console.error("Failed to update has_backup_codes flag:", userUpdateError);
      // Log the error but don't fail the request since 2FA was successfully disabled
    }

    // Update all device sessions to AAL1 since 2FA is now disabled
    const { error: sessionUpdateError } = await supabaseAdmin
      .from("device_sessions")
      .update({ aal: "aal1" })
      .eq("user_id", user.id)
      .eq("aal", "aal2");

    if (sessionUpdateError) {
      console.error("Failed to update device sessions:", sessionUpdateError);
      // Log the error but don't fail the request since 2FA was successfully disabled
    }

    // Log the 2FA disable event
    await logAccountEvent({
      user_id: user.id,
      event_type: "2FA_DISABLED",
      device_session_id: deviceSessionId,
      metadata: {
        method,
        category: "warning",
        description: `Two-factor authentication disabled for ${method} method`,
      },
    });

    // Send alert for 2FA disable if enabled
    if (
      AUTH_CONFIG.emailAlerts.twoFactor.enabled &&
      AUTH_CONFIG.emailAlerts.twoFactor.alertOnDisable
    ) {
      const methodConfig =
        AUTH_CONFIG.verificationMethods.twoFactor[
          method as keyof typeof AUTH_CONFIG.verificationMethods.twoFactor
        ];

      await sendEmailAlert({
        request,
        origin,
        user,
        title: "Two-factor authentication disabled",
        message: `${methodConfig.title} two-factor authentication was disabled on your account. If this wasn't you, please secure your account immediately.`,
        method,
        device: deviceInfo,
      });
    }

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error in 2FA disable:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
