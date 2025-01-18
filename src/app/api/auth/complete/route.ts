import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import * as UAParser from "ua-parser-js";
import {
  calculateDeviceConfidence,
  getConfidenceLevel,
} from "@/utils/device-confidence";
import { TAuthProvider } from "@/types/auth";
import { TApiErrorResponse } from "@/types/api";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const provider = searchParams.get("provider");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();
  const userAgent = request.headers.get("user-agent") || "";
  const parser = new (UAParser as any)();
  parser.setUA(userAgent);

  const device = parser.getDevice();
  const browser = parser.getBrowser();
  const os = parser.getOS();

  const deviceName =
    device.vendor && device.model
      ? `${device.vendor} ${device.model}`
      : os.name
        ? `${os.name} Device`
        : "Privacy Browser";

  // Get user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=failed_to_get_user&message=${encodeURIComponent(userError?.message || "No user found")}`
    );
  }

  // Check if user exists in DB
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  // Create user in DB if they don't exist
  if (!existingUser) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: user.id,
            email: user.email!,
            auth_method: provider as TAuthProvider,
          }),
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as TApiErrorResponse;
        throw new Error(errorData.error);
      }
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("duplicate key")) {
        console.warn("Duplicate key error detected");
      } else {
        return NextResponse.redirect(
          `${origin}/auth/error?error=failed_to_create_user&message=${encodeURIComponent(err.message)}`
        );
      }
    }
  }

  // Get trusted sessions for confidence calculation
  const trustedSessionsResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/device-sessions/trusted`,
    {
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    }
  );
  const { data: trustedSessions } = await trustedSessionsResponse.json();

  const currentDevice = {
    device_name: deviceName,
    browser: browser.name || null,
    os: os.name || null,
    ip_address: request.headers.get("x-forwarded-for") || undefined,
  };

  // Check the current device against trusted device sessions only
  const score = calculateDeviceConfidence(
    trustedSessions || null,
    currentDevice
  );

  const confidenceLevel = getConfidenceLevel(score);

  // Decide if verification for the device is needed
  const needsVerification = process.env.RESEND_API_KEY
    ? confidenceLevel === "low" ||
      (confidenceLevel === "medium" && provider === "email")
    : false;

  // A device is trusted if Resend isn't configured OR has high confidence OR medium confidence from OAuth
  const isTrusted =
    !process.env.RESEND_API_KEY ||
    confidenceLevel === "high" ||
    (confidenceLevel === "medium" && provider !== "email");

  // Create session with these settings
  const session_id = crypto.randomUUID();

  // Create device session using the API
  const createSessionResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/device-sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        user_id: user.id,
        session_id,
        device: currentDevice,
        confidence_score: score,
        needs_verification: needsVerification,
        is_trusted: isTrusted,
      }),
    }
  );

  if (!createSessionResponse.ok) {
    const error = await createSessionResponse.json();
    console.error("Failed to create device session:", error);
    return NextResponse.redirect(
      `${origin}/auth/error?error=failed_to_create_session&message=${encodeURIComponent(error.error || "Unknown error")}`
    );
  }

  // If verification is needed, send verification code
  if (needsVerification) {
    try {
      const sendCodeResponse = await fetch(
        `${origin}/api/auth/verify-device/send-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            device_session_id: session_id,
            device_name: deviceName,
          }),
        }
      );

      if (!sendCodeResponse.ok) {
        const error = await sendCodeResponse.json();
        return NextResponse.redirect(
          `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}&error=send_failed&message=${encodeURIComponent(error.error || "We couldn't send you a verification code right now.")}`
        );
      }

      // Redirect to verification page
      return NextResponse.redirect(
        `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}`
      );
    } catch (error) {
      console.error("Failed to send verification code:", error);
      return NextResponse.redirect(
        `${origin}/auth/verify-device?session=${session_id}&next=${encodeURIComponent(next)}&error=network_error`
      );
    }
  }

  // Send email notification (if Resend is configured)
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
            Cookie: request.headers.get("cookie") || "",
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

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  // Create the response with appropriate redirect
  const response = isLocalEnv
    ? NextResponse.redirect(`${origin}${next}`)
    : forwardedHost
      ? NextResponse.redirect(`https://${forwardedHost}${next}`)
      : NextResponse.redirect(`${origin}${next}`);

  // Set the device session ID cookie
  response.cookies.set("device_session_id", session_id, {
    httpOnly: true,
    secure: !isLocalEnv,
    sameSite: "lax",
  });

  return response;
}
