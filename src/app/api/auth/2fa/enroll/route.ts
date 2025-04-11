import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TEnroll2FARequest,
  TEnroll2FAResponse,
} from "@/types/api";
import {
  authRateLimit,
  smsRateLimit,
  getClientIp,
  apiRateLimit,
} from "@/utils/rate-limit";
import { AUTH_CONFIG } from "@/config/auth";
import { twoFactorEnrollmentSchema } from "@/validation/auth-validation";
import {
  getUser,
  getUserVerificationMethods,
  hasGracePeriodExpired,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { sendEmailAlert } from "@/utils/email-alerts";
import { logAccountEvent } from "@/utils/account-events/server";
import { UAParser } from "ua-parser-js";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    if (authRateLimit) {
      const ip = getClientIp(request);
      if (apiRateLimit) {
        const { success } = await apiRateLimit.limit(ip);

        if (!success) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }
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

    // 2. Get and validate request body
    const rawBody = await request.json();
    const validation = twoFactorEnrollmentSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TEnroll2FARequest = validation.data;
    const { checkVerificationOnly = false } = body;

    // 3. Validate method configuration
    const methodConfig =
      AUTH_CONFIG.verificationMethods.twoFactor[
        body.method as keyof typeof AUTH_CONFIG.verificationMethods.twoFactor
      ];
    if (!methodConfig?.enabled) {
      return NextResponse.json(
        { error: `${body.method} method is not enabled` },
        { status: 403 }
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

      const parser = new UAParser(request.headers.get("user-agent") || "");

      // Send alert for 2FA setup initiation if enabled
      if (
        !checkVerificationOnly &&
        AUTH_CONFIG.emailAlerts.twoFactor.enabled &&
        AUTH_CONFIG.emailAlerts.twoFactor.alertOnEnable
      ) {
        await sendEmailAlert({
          request,
          origin,
          user,
          title: "Two-factor authentication setup requested",
          message:
            "Someone has requested to enable two-factor authentication on your account. If this wasn't you, please secure your account immediately.",
          method: body.method,
          device: {
            user_id: user.id,
            device_name: parser.getDevice().model || "Unknown Device",
            browser: parser.getBrowser().name || null,
            os: parser.getOS().name || null,
            ip_address: getClientIp(request),
          },
        });
      }

      // Return available methods for verification
      if (has2FA) {
        return NextResponse.json({
          requiresVerification: true,
          availableMethods: factors,
        }) satisfies NextResponse<TEnroll2FAResponse>;
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
          requiresVerification: true,
          availableMethods,
        }) satisfies NextResponse<TEnroll2FAResponse>;
      }
    }

    // If we're just checking requirements, check verification status
    if (checkVerificationOnly) {
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

        // If user has 2FA, they must use it
        if (has2FA) {
          return NextResponse.json({
            requiresVerification: true,
            availableMethods: factors,
            factor_id: "", // Just to satisfy the type
          }) satisfies NextResponse<TEnroll2FAResponse>;
        }

        // Otherwise they can use basic verification methods
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
          requiresVerification: true,
          availableMethods,
          factor_id: "", // Just to satisfy the type
        }) satisfies NextResponse<TEnroll2FAResponse>;
      }

      return NextResponse.json({
        requiresVerification: false,
        factor_id: "", // Just to satisfy the type
      }) satisfies NextResponse<TEnroll2FAResponse>;
    }

    // Log sensitive action verification
    const parser = new UAParser(request.headers.get("user-agent") || "");
    await logAccountEvent({
      user_id: user.id,
      event_type: "SENSITIVE_ACTION_VERIFIED",
      device_session_id: deviceSessionId,
      metadata: {
        device: {
          device_name: parser.getDevice().model || "Unknown Device",
          browser: parser.getBrowser().name || null,
          os: parser.getOS().name || null,
          ip_address: getClientIp(request),
        },
        action: "ENABLE_2FA",
        category: "warning",
        description: `Two-factor authentication setup verified for ${body.method} method`,
      },
    });

    // 4. Get client IP securely
    const clientIp = getClientIp(request);

    // 5. Apply rate limits in order of most specific to least specific
    if (body.method === "sms" && smsRateLimit) {
      // Check user-based rate limit first (most specific)
      const { success: userSuccess } = await smsRateLimit.user.limit(user.id);
      if (!userSuccess) {
        return NextResponse.json(
          {
            error:
              "Daily SMS limit reached for this account. Please try again tomorrow.",
          },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      // Then check IP-based rate limit
      const { success: ipSuccess } = await smsRateLimit.ip.limit(clientIp);
      if (!ipSuccess) {
        return NextResponse.json(
          {
            error:
              "Too many SMS requests from this IP. Please try again later.",
          },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 6. Apply general auth rate limit last (least specific)
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 7. Handle SMS enrollment with validated phone number
    if (body.method === "sms") {
      // Get existing factors to determine index
      const { data: existingFactors } = await supabase.auth.mfa.listFactors();
      const smsFactors =
        existingFactors?.all?.filter((f) => f.factor_type === "phone") || [];
      const smsIndex = smsFactors.length + 1;

      // Type narrowing - we know phone exists when method is "sms"
      const { phone } = body as { phone: string };
      const { data: factorData, error: factorError } =
        await supabase.auth.mfa.enroll({
          factorType: "phone",
          phone,
          friendlyName: `SMS ${smsIndex}`,
        });

      if (factorError) {
        console.error("Failed to enroll in SMS 2FA:", factorError);
        return NextResponse.json(
          { error: factorError.message },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }

      return NextResponse.json({
        factor_id: factorData.id,
        phone: factorData.phone,
      }) satisfies NextResponse<TEnroll2FAResponse>;
    }

    // 8. Handle authenticator enrollment
    const { data: factors } = await supabase.auth.mfa.listFactors();

    // Check for existing unverified TOTP factors and remove them
    if (factors?.all) {
      const unverifiedTotpFactors = factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );

      // Remove any unverified TOTP factors
      for (const factor of unverifiedTotpFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    // Count existing verified TOTP factors for naming
    const totpFactors =
      factors?.all?.filter(
        (f) => f.factor_type === "totp" && f.status === "verified"
      ) || [];
    const totpIndex = totpFactors.length + 1;

    const { data: factorData, error: factorError } =
      await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${totpIndex}`,
      });

    if (factorError) {
      console.error("Failed to enroll in 2FA:", factorError);
      return NextResponse.json(
        { error: factorError.message },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({
      qr_code: factorData.totp.qr_code,
      secret: factorData.totp.secret,
      factor_id: factorData.id,
    }) satisfies NextResponse<TEnroll2FAResponse>;
  } catch (error) {
    console.error("Error in 2FA enrollment:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
