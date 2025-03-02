import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { profileUpdateSchema } from "@/utils/validation/auth-validation";
import {
  TApiErrorResponse,
  TEmptySuccessResponse,
  TUpdateUserRequest,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";

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

    // Verify user authentication
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

    // Validate request body
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

    // Update user profile in database
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

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
