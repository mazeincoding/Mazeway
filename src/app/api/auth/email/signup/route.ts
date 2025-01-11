import { createClient } from "@/utils/supabase/server";
import { validateFormData } from "@/utils/validation/auth-validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateFormData(body);

    if (validation.error || !validation.data) {
      return NextResponse.json(
        { error: validation.error || "Invalid input" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.signUp(
      validation.data
    );

    // Check for existing user
    if (data?.user?.identities?.length === 0) {
      return NextResponse.json(
        {
          error:
            "This email is already registered. Please try logging in instead.",
        },
        { status: 400 }
      );
    }

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
