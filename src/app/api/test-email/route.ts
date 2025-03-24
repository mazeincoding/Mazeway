import { NextResponse } from "next/server";
import { Resend } from "resend";

// Initialize outside of the handler
let resend: Resend | null = null;

export async function POST() {
  try {
    console.log("Starting test request");

    // Initialize only if not already initialized
    if (!resend) {
      console.log("Initializing Resend in test route");
      resend = new Resend(process.env.RESEND_API_KEY);
      console.log("Resend initialized in test route");
    }

    // Just return success for now to test initialization
    return NextResponse.json({ message: "Test route working" });
  } catch (error) {
    console.error("Test route error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}

// Also add a GET method for easier testing
export async function GET() {
  try {
    console.log("Starting test GET request");
    return NextResponse.json({ message: "Test route GET working" });
  } catch (error) {
    console.error("Test route GET error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
