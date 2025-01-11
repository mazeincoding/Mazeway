"use client";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  // const token = searchParams.get("token");
  const token = "1234567890";

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh py-8">
      {token ? (
        <Card className="max-w-sm w-full mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">
              Enter verification code from email
            </CardTitle>
            <CardDescription className="text-base">
              Please enter the verification code we sent to hi@example.com.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InputOTP maxLength={6}>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTP>
          </CardContent>
          <CardFooter className="flex flex-col gap-6">
            <Button className="w-full">Verify Code</Button>
            <Button
              variant="link"
              className="h-auto w-auto p-0 text-muted-foreground hover:text-foreground transition-none"
            >
              Resend code
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Alert variant="destructive" className="max-w-md mx-auto mt-8">
          <AlertDescription>No verification token provided</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
