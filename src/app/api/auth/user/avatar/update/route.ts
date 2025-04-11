import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TApiErrorResponse, TUpdateAvatarResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { getUser } from "@/utils/auth";
import { getCurrentDeviceSessionId } from "@/utils/auth/device-sessions";
import { logAccountEvent } from "@/utils/account-events/server";

export async function POST(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = getClientIp(request);
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();
    const { user, error } = await getUser({ supabase });
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get device session ID from cookie
    const deviceSessionId = getCurrentDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Verify device session is valid and belongs to user
    const { data: deviceSession, error: sessionError } = await supabase
      .from("device_sessions")
      .select("id")
      .eq("id", deviceSessionId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !deviceSession) {
      return NextResponse.json(
        { error: "Invalid or expired device session" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the form data with the file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Create a unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${timestamp}.${fileExt}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("profile-pics")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload avatar:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from("profile-pics")
      .getPublicUrl(fileName);

    const avatarUrl = publicUrlData.publicUrl;

    // Update user profile with new avatar URL
    const { error: updateError } = await supabase
      .from("users")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update user profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Log the avatar update
    await logAccountEvent({
      user_id: user.id,
      event_type: "PROFILE_UPDATED",
      device_session_id: deviceSessionId,
      metadata: {
        fields: ["avatar_url"],
        category: "info",
        description: "Profile picture updated",
      },
    });

    return NextResponse.json({
      avatarUrl,
    }) satisfies NextResponse<TUpdateAvatarResponse>;
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
