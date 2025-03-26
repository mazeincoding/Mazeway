import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TConnectSocialProviderRequest,
  TConnectSocialProviderResponse,
} from "@/types/api";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import {
  getUser,
  getUserVerificationMethods,
  hasGracePeriodExpired,
  getDeviceSessionId,
} from "@/utils/auth";
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

    const body: TConnectSocialProviderRequest = validation.data;
    const { provider } = body;

    // 4. Get device session ID
    const deviceSessionId = getDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 5. Check if verification is needed
    const needsVerification =
      AUTH_CONFIG.requireFreshVerification.connectProvider &&
      (await hasGracePeriodExpired({
        deviceSessionId,
        supabase,
      }));

    if (needsVerification) {
      // Get available verification methods
      const { has2FA, factors, methods } = await getUserVerificationMethods({
        supabase,
        supabaseAdmin,
      });

      // Return available methods for verification
      if (has2FA) {
        return NextResponse.json({
          requiresTwoFactor: true,
          factorId: factors[0].factorId,
          availableMethods: factors,
        }) satisfies NextResponse<TConnectSocialProviderResponse>;
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
        }) satisfies NextResponse<TConnectSocialProviderResponse>;
      }
    }

    // 6. Link identity
    const { data, error: linkError } = await supabase.auth.linkIdentity({
      provider,
    });

    if (linkError) {
      console.error("Failed to link identity:", linkError);
      return NextResponse.json(
        { error: linkError.message },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 7. Log sensitive action verification
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
        action: "connect_provider",
        category: "info",
        description: `Social provider connection verified: ${provider}`,
      },
    });

    // 8. Log the connection event
    await logAccountEvent({
      user_id: user.id,
      event_type: "SOCIAL_PROVIDER_CONNECTED",
      metadata: {
        provider,
        category: "info",
        description: `Connected ${provider} account`,
      },
    });

    // 9. Send email alert if enabled
    if (
      AUTH_CONFIG.emailAlerts.socialProviders.enabled &&
      AUTH_CONFIG.emailAlerts.socialProviders.alertOnConnect
    ) {
      const providerTitle =
        provider.charAt(0).toUpperCase() + provider.slice(1);
      await sendEmailAlert({
        request,
        origin,
        user,
        title: `${providerTitle} account connected`,
        message: `A ${providerTitle} account was connected to your account. If this wasn't you, please secure your account immediately.`,
      });
    }

    return NextResponse.json(
      data
    ) satisfies NextResponse<TConnectSocialProviderResponse>;
  } catch (error) {
    console.error("Error in social provider connect:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
