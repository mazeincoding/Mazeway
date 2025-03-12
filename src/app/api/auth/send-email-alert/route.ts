import EmailAlertTemplate from "@emails/templates/email-alert";
import { Resend } from "resend";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse } from "@/types/api";
import { TDeviceInfo } from "@/types/auth";
import { createClient } from "@/utils/supabase/server";
import { validateEmailAlert } from "@/utils/validation/auth-validation";
import { getUser } from "@/utils/auth";

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Get the sender email from environment variables or use a default
const SENDER_EMAIL = process.env.SENDER_EMAIL || "Acme <onboarding@resend.dev>";

export async function POST(request: NextRequest) {
  console.log("Email alert request received");

  try {
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        console.log(`Rate limit hit for IP: ${ip}`);
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();
    const { user, error } = await getUser(supabase);
    if (error || !user) {
      console.log(`Auth failed: ${error || "No user"}`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    console.log(`User authenticated: ${user.id}`);

    // 3. Parse and validate request body
    const rawBody = await request.json();
    const {
      isValid,
      error: validationError,
      data,
    } = validateEmailAlert(rawBody);

    if (!isValid || !data) {
      console.log(`Invalid request: ${validationError || "Unknown error"}`);
      return NextResponse.json(
        { error: validationError || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { email, device } = data;
    console.log(`Processing alert for: ${email}`);

    // 4. Verify the user has permission to send alerts to this email
    // Only allow sending alerts to the authenticated user's email
    const { data: userData } = await supabase
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!userData || userData.email !== email) {
      console.log(
        `Email mismatch. Requested: ${email}, User's: ${userData?.email || "not found"}`
      );
      return NextResponse.json(
        { error: "You don't have permission to send alerts to this email" },
        { status: 403 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 5. Parse device info if it's a string
    const deviceInfo: TDeviceInfo =
      typeof device === "string" ? (JSON.parse(device) as TDeviceInfo) : device;

    console.log(`Device: ${deviceInfo.device_name} (${deviceInfo.browser})`);

    // 6. Get the current device session
    const deviceSessionId = request.cookies.get("device_session_id")?.value;

    if (deviceSessionId) {
      // Get the device session and associated device
      const { data: deviceSession } = await supabase
        .from("device_sessions")
        .select("device_id")
        .eq("id", deviceSessionId)
        .eq("user_id", user.id)
        .single();

      if (deviceSession?.device_id) {
        console.log(`Updating device: ${deviceSession.device_id}`);
        // Update the device with the latest info
        await supabase
          .from("devices")
          .update({
            device_name: deviceInfo.device_name,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            ip_address: deviceInfo.ip_address,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceSession.device_id);
      }
    } else {
      // If no device session, check if this device exists
      const { data: existingDevice } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", user.id)
        .eq("device_name", deviceInfo.device_name)
        .eq("browser", deviceInfo.browser)
        .eq("os", deviceInfo.os)
        .maybeSingle();

      if (existingDevice) {
        console.log(`Updating existing device: ${existingDevice.id}`);
        // Update the device with the latest IP address
        await supabase
          .from("devices")
          .update({
            ip_address: deviceInfo.ip_address,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDevice.id);
      } else {
        console.log("Creating new device record");
        // Create a new device record
        const { error: deviceError } = await supabase.from("devices").insert({
          user_id: user.id,
          device_name: deviceInfo.device_name,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip_address: deviceInfo.ip_address,
        });

        if (deviceError) {
          console.log(`Device creation error: ${deviceError.message}`);
        }
      }
    }

    // 7. Send email using Resend
    console.log(`Sending alert email to: ${email}`);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: email,
      subject: "Security Alert: New Login Detected",
      react: EmailAlertTemplate({
        email,
        device: deviceInfo,
      }),
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return NextResponse.json(
        {
          error: emailError.message,
        },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    console.log("Email sent successfully");

    return NextResponse.json(
      {
        message: "Email alert sent successfully",
        data: emailData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
