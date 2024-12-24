import { EmailAlertTemplate } from "@/components/email-alert-template";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, device } = await request.json();

    const { data, error } = await resend.emails.send({
      from: "Acme <onboarding@resend.dev>",
      to: ["delivered@resend.dev"],
      subject: "Hello world",
      react: EmailAlertTemplate({
        email,
        device,
      }),
    });

    if (error) {
      console.error("Resend API error:", error);
      return Response.json(
        {
          message: "Failed to send email",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return Response.json(
      {
        message: "Email sent successfully",
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return Response.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
