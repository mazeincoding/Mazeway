import { createClient } from "@/utils/supabase/server";
import { validateFormData } from "@/utils/validation/auth-validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { origin } = new URL(request.url);
    const body = await request.json();
    const validation = validateFormData(body);

    if (validation.error || !validation.data) {
      return NextResponse.json(
        { error: validation.error || "Invalid input" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword(
      validation.data
    );

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Redirect to complete route after successful login
    return NextResponse.redirect(
      `${origin}/api/auth/complete?provider=email&next=/`
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
