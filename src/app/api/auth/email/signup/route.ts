import { createClient } from "@/utils/supabase/server";
import { validateFormData } from "@/utils/validation/auth-validation";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, getClientIp } from "@/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

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

    if (authError) {
      if (authError.code === "user_already_exists") {
        return NextResponse.json(
          {
            error:
              "This email is already in use. Please try logging in instead.",
          },
          { status: 400 }
        );
      }
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
