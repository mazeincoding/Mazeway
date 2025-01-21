import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PostgrestError } from "@supabase/supabase-js";
import {
  TApiErrorResponse,
  TCreateUserRequest,
  TEmptySuccessResponse,
} from "@/types/api";
import { apiRateLimit } from "@/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await apiRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
          },
          { status: 429 }
        );
      }
    }

    const supabase = await createClient();
    const userData: TCreateUserRequest = await request.json();

    const { error } = await supabase.from("users").insert({
      id: userData.id,
      email: userData.email,
      name: userData.email.split("@")[0],
      avatar_url: null,
    });

    if (error) {
      console.error("Error occurred with ID:", userData.id);
      throw error;
    }

    return NextResponse.json(
      {},
      { status: 200 }
    ) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    const err = error as PostgrestError;
    console.error("Error creating user:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
