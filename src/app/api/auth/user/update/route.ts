import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { profileUpdateSchema } from "@/validation/auth-validation";
import {
  TApiErrorResponse,
  TEmptySuccessResponse,
  TUpdateUserRequest,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { getUser } from "@/utils/auth";
import { getCurrentDeviceSession } from "@/utils/auth/device-sessions/server";
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

    const {
      deviceSession,
      isValid,
      error: sessionError,
    } = await getCurrentDeviceSession({ request, supabase, user });

    if (!isValid || !deviceSession) {
      console.error("Invalid device session for user update", {
        userId: user.id,
        error: sessionError?.message,
      });
      return NextResponse.json(
        { error: sessionError?.message || "Invalid or expired device session" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body = await request.json();
    const validation = profileUpdateSchema.safeParse(body) as {
      success: boolean;
      data: TUpdateUserRequest;
      error?: any;
    };

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const updateData = validation.data.data;

    if (updateData.email) {
      return NextResponse.json(
        {
          error: "Email updates must be done through the change-email endpoint",
        },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        ...updateData,
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

    await logAccountEvent({
      user_id: user.id,
      event_type: "PROFILE_UPDATED",
      device_session_id: deviceSession.id,
      metadata: {
        fields: Object.keys(updateData),
        category: "info",
        description: `Profile updated: ${Object.keys(updateData).join(", ")}`,
      },
    });

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
