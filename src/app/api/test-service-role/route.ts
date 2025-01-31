import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  console.log("Creating Supabase client with service role...");
  const supabase = await createClient({ useServiceRole: true });
  console.log("Service role status:", {
    hasServiceRole: !!supabase.auth.admin,
  });

  try {
    // Call getUser but ignore result
    console.log("Calling auth.getUser()...");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    console.log("GetUser result:", {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
    });
    console.log("Service role status after getUser:", {
      hasServiceRole: !!supabase.auth.admin,
    });

    const testDevice = {
      device_name: "Windows Device",
      browser: "Chrome",
      os: "Windows",
      ip_address: "::1",
    };

    console.log("Attempting to insert device:", testDevice);
    const { data, error } = await supabase
      .from("test_devices")
      .insert(testDevice)
      .select()
      .single();

    if (error) {
      console.log("Error inserting:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("Success! Inserted:", data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Caught error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
