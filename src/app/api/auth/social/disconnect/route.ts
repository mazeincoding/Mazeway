import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UserIdentity } from "@supabase/supabase-js";
import {
  TApiErrorResponse,
  TDisconnectSocialProviderRequest,
  TDisconnectSocialProviderResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUser,
  getUserVerificationMethods,
  hasGracePeriodExpired,
} from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { logAccountEvent } from "@/utils/account-events/server";
import { socialProviderSchema } from "@/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { sendEmailAlert } from "@/utils/email-alerts";
import { UAParser } from "ua-parser-js";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  try {
    // 1. Rate limiting
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        console.log("❌ Rate limit exceeded for IP:", ip);
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // 2. Get and validate user
    const supabase = await createClient();
    const supabaseAdmin = await createClient({ useServiceRole: true });

    const { user, error } = await getUser({ supabase });
    if (error) console.error("⚠️ User validation error:", error);

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 3. Get and validate request body
    const rawBody = await request.json();
    const validation = socialProviderSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TDisconnectSocialProviderRequest = validation.data;
    const { provider, checkVerificationOnly = false } = body;

    // 4. Get device session ID
    const deviceSessionId = getCurrentDeviceSessionId(request);

    if (!deviceSessionId) {
      console.log("❌ No device session found");
      return NextResponse.json(
        { error: "No device session found" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 5. Get user identities
    const { data, error: identitiesError } =
      await supabase.auth.getUserIdentities();

    if (identitiesError || !data?.identities) {
      console.error("❌ Failed to get user identities:", identitiesError);
      return NextResponse.json(
        { error: identitiesError?.message || "Failed to get user identities" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { identities } = data;

    // 6. Find and validate the identity
    const identity = identities.find(
      (i: UserIdentity) => i.provider === provider
    );

    if (!identity) {
      console.log(`❌ No ${provider} identity found`);
      return NextResponse.json(
        { error: `No ${provider} identity found` },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 7. Check if user has at least 2 identities
    if (identities.length < 2) {
      console.log("❌ Cannot disconnect only identity");
      return NextResponse.json(
        {
          error:
            "Cannot disconnect the only identity. Add another login method first.",
        },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if verification is needed
    const needsVerification = await hasGracePeriodExpired({
      deviceSessionId,
      supabase,
    });

    if (needsVerification) {
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      if (has2FA) {
        return NextResponse.json({
          requiresVerification: true,
          availableMethods: factors,
        }) satisfies NextResponse<TDisconnectSocialProviderResponse>;
      } else {
        const availableMethods = methods.map((method) => ({
          type: method,
          factorId: method,
        }));

        if (availableMethods.length === 0) {
          console.log("❌ No verification methods available");
          return NextResponse.json(
            { error: "No verification methods available" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        return NextResponse.json({
          requiresVerification: true,
          availableMethods,
        }) satisfies NextResponse<TDisconnectSocialProviderResponse>;
      }
    }

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
          }) satisfies NextResponse<TDisconnectSocialProviderResponse>;
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
        }) satisfies NextResponse<TDisconnectSocialProviderResponse>;
      }

      return NextResponse.json({
        requiresVerification: false,
        success: true,
      }) satisfies NextResponse<TDisconnectSocialProviderResponse>;
    }

    // 9. Unlink identity
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
    if (unlinkError) {
      console.error("❌ Failed to unlink identity:", unlinkError);
      return NextResponse.json(
        { error: unlinkError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 10. Log sensitive action verification
    const parser = new UAParser(request.headers.get("user-agent") || "");
    const deviceInfo = {
      device_name: parser.getDevice().model || "Unknown Device",
      browser: parser.getBrowser().name || null,
      os: parser.getOS().name || null,
      ip_address: getClientIp(request),
    };

    await logAccountEvent({
      user_id: user.id,
      event_type: "SENSITIVE_ACTION_VERIFIED",
      device_session_id: deviceSessionId,
      metadata: {
        device: deviceInfo,
        action: "disconnect_provider",
        category: "warning",
        description: `Social provider disconnection verified: ${provider}`,
      },
    });

    // 11. Log the disconnection event
    await logAccountEvent({
      user_id: user.id,
      event_type: "SOCIAL_PROVIDER_DISCONNECTED",
      metadata: {
        provider,
        category: "warning",
        description: `Disconnected ${provider} account`,
      },
    });

    // 12. Send email alert if enabled
    if (
      AUTH_CONFIG.emailAlerts.socialProviders.enabled &&
      AUTH_CONFIG.emailAlerts.socialProviders.alertOnDisconnect
    ) {
      const providerTitle =
        provider.charAt(0).toUpperCase() + provider.slice(1);
      await sendEmailAlert({
        request,
        origin,
        user,
        title: `${providerTitle} account disconnected`,
        message: `Your ${providerTitle} account was disconnected from your account. If this wasn't you, please secure your account immediately.`,
      });
    }

    return NextResponse.json({
      success: true,
      requiresVerification: false,
    }) satisfies NextResponse<TDisconnectSocialProviderResponse>;
  } catch (error) {
    console.error("💥 Unexpected error in social provider disconnect:", error);
    console.error("Stack trace:", (error as Error).stack);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
