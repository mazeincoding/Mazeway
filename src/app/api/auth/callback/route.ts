import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createUser } from "@/actions/auth/create-user";
import * as UAParser from "ua-parser-js";
import { createDeviceSession } from "@/actions/auth/device-sessions";
import { getDeviceSessions } from "@/actions/auth/device-sessions";
import {
  calculateDeviceConfidence,
  getConfidenceLevel,
} from "@/utils/device-confidence";
import { TAccessLevel } from "@/types/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const provider = searchParams.get("provider");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  // Get User-Agent from request headers
  const userAgent = request.headers.get("user-agent") || "";
  const parser = new (UAParser as any)();
  parser.setUA(userAgent);

  const device = parser.getDevice();
  const browser = parser.getBrowser();
  const os = parser.getOS();

  // Generate device name
  const deviceName =
    device.vendor && device.model
      ? `${device.vendor} ${device.model}`
      : os.name
        ? `${os.name} Device`
        : "Privacy Browser";

  // Handle Google OAuth
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=google_callback_error`
      );
    }
  }

  // At this point we have a valid session (either from OAuth or email login)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=failed_to_get_user`
    );
  }

  // Create user in our database
  const { error: createError } = await createUser({
    id: user.id,
    email: user.email!,
    auth_method: provider as "google" | "email",
  });

  // If we get a duplicate key error, that's fine - the user already exists
  // This is secure because:
  // 1. The user has proven ownership of the email through Google's OAuth
  // 2. Google has verified their identity and explicitly granted permission
  // 3. Supabase handles the provider linking securely, ensuring the email matches
  if (createError && !createError.includes("duplicate key")) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=failed_to_create_user`
    );
  }

  // After getting user but before creating session
  const { data: existingSessions } = await getDeviceSessions(user.id);

  if (existingSessions?.length) {
    const currentDevice = {
      device_name: deviceName,
      browser: browser.name || null,
      os: os.name || null,
      ip_address: request.headers.get("x-forwarded-for") || undefined,
    };

    // Check against most recent session
    const score = calculateDeviceConfidence(
      existingSessions[0].device,
      currentDevice
    );

    const confidenceLevel = getConfidenceLevel(score);

    // 1. Decide verification needs
    const needsVerification =
      confidenceLevel === "low" ||
      (confidenceLevel === "medium" && provider === "email");

    // 2. Set access level based on confidence and provider
    const accessLevel: TAccessLevel =
      provider === "google" && confidenceLevel !== "low"
        ? "full"
        : confidenceLevel === "high"
          ? "full"
          : confidenceLevel === "medium"
            ? "verified"
            : "restricted";

    // 3. Create session with these settings
    const { error: sessionError } = await createDeviceSession({
      user_id: user.id,
      session_id: code!,
      device: currentDevice,
      security: {
        accessLevel,
        verificationLevel: needsVerification ? "full" : "none",
        confidenceScore: score,
        needsVerification,
      },
    });

    // 4. Send email notification (if Resend is configured)
    if (!sessionError) {
      if (!process.env.RESEND_API_KEY) {
        console.log(
          "RESEND_API_KEY not configured. Login notification emails are disabled."
        );
      } else {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/send-email-alert`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to send email: ${error.message}`);
          }
        } catch (emailError) {
          // Log error but don't block auth flow
          console.error("Failed to send login notification:", emailError);
        }
      }
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  } else {
    return NextResponse.redirect(`${origin}${next}`);
  }
}
