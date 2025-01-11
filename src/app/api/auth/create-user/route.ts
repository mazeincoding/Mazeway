import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PostgrestError } from "@supabase/supabase-js";
import {
  TApiErrorResponse,
  TCreateUserRequest,
  TEmptySuccessResponse,
} from "@/types/api";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const userData: TCreateUserRequest = await request.json();

    const { error } = await supabase.from("users").insert({
      id: userData.id,
      email: userData.email,
      name: userData.email.split("@")[0],
      avatar_url: null,
      auth_method: userData.auth_method,
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
