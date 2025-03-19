import { NextResponse } from "next/server";

// No top-level imports of Resend
export async function POST() {
  try {
    console.log("Starting request");

    // Dynamically import Resend
    const { Resend } = await import("resend");
    console.log("Imported Resend");

    // Create instance using Function constructor to avoid static analysis
    const createResend = new Function(
      "key",
      "Resend",
      "return new Resend(key)"
    );
    console.log("Created factory");

    // Initialize with lots of logging
    console.log("About to initialize");
    const resend = createResend(process.env.RESEND_API_KEY, Resend);
    console.log("Initialized successfully");

    return NextResponse.json({ message: "Email alert received" });
  } catch (error) {
    console.error("Error occurred:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
