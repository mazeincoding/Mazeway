import { NextResponse } from "next/server";
import { Resend } from "resend";

// Fuck it, let's try the simple way first
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    console.log("Test email route hit");
    return NextResponse.json({ message: "I work!" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
