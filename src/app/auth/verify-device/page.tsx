"use client";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import type { TDeviceSession } from "@/types/auth";
import { BackButton } from "@/components/back-button";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get("session");
  const next = searchParams.get("next") || "/";
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  const [showDetails, setShowDetails] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_session_id: session,
          code,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Stay on same page but with error
        router.push(
          `/auth/verify-device?session=${session}&next=${encodeURIComponent(next)}&error=${error.error}&message=${encodeURIComponent(error.message)}`
        );
        return;
      }

      // Redirect to next URL on success
      router.push(next);
    } catch (error) {
      router.push(
        `/auth/verify-device?session=${session}&next=${encodeURIComponent(next)}&error=network_error`
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setIsSendingCode(true);
    try {
      // Get device info first
      const supabase = createClient();
      const { data: deviceSession, error: deviceError } = await supabase
        .from("device_sessions")
        .select(
          `
          session_id,
          device:devices (
            device_name
          )
        `
        )
        .eq("session_id", session)
        .single<TDeviceSession>();

      if (deviceError || !deviceSession?.device?.device_name) {
        router.push(
          `/auth/verify-device?session=${session}&next=${encodeURIComponent(next)}&error=device_not_found&message=${encodeURIComponent(deviceError?.message || "Device session not found")}`
        );
        return;
      }

      // Send verification code
      const response = await fetch("/api/auth/verify-device/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_session_id: session,
          device_name: deviceSession.device.device_name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        router.push(
          `/auth/verify-device?session=${session}&next=${encodeURIComponent(next)}&error=${error.error}&message=${encodeURIComponent(error.message)}`
        );
        return;
      }

      // Reset error state and code input
      router.push(
        `/auth/verify-device?session=${session}&next=${encodeURIComponent(next)}`
      );
    } catch (error) {
      router.push(
        `/auth/verify-device?session=${session}&next=${encodeURIComponent(next)}&error=network_error`
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="p-4 pb-0">
          <BackButton />
        </div>
        <main className="flex-grow flex items-center justify-center px-8 py-10">
          <Card className="max-w-sm w-full mx-auto border-destructive/35">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">
                Invalid Request
              </CardTitle>
              <CardDescription className="text-base">
                We couldn't find a verification session. This usually happens
                when:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>The verification link has expired</li>
                <li>The URL is incomplete or malformed</li>
                <li>You've already verified this device</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/")}
              >
                Return Home
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 pb-0">
        <BackButton />
      </div>
      <main className="flex-grow flex items-center justify-center px-8 py-10">
        <Card
          className={cn(
            "max-w-sm w-full mx-auto",
            error && "border-destructive/35"
          )}
        >
          <CardHeader className="space-y-0 gap-3">
            <CardTitle className="text-2xl font-bold">
              {error ? "Verification failed" : "Verify this device"}
            </CardTitle>
            <CardDescription className="text-base">
              {!error
                ? "Please enter the verification code we sent to your email."
                : "We couldn't verify your device. Your code might have expired or be invalid."}
            </CardDescription>
          </CardHeader>
          {!error && (
            <CardContent>
              <InputOTP
                maxLength={6}
                className="gap-2"
                value={code}
                onChange={setCode}
              >
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTP>
            </CardContent>
          )}
          <CardFooter className="flex flex-col gap-4">
            {!error ? (
              <>
                <Button
                  className="w-full"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || isVerifying || isSendingCode}
                >
                  {isVerifying ? "Verifying..." : "Verify Code"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleResendCode}
                  disabled={isVerifying || isSendingCode}
                >
                  {isSendingCode ? "Sending..." : "Resend code"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={handleResendCode}
                  disabled={isVerifying || isSendingCode}
                >
                  {isSendingCode ? "Sending..." : "Get new code"}
                </Button>
                {(error || message) && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setShowDetails(!showDetails)}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      {showDetails ? "Hide error details" : "See error details"}
                      <ChevronRight
                        className={`h-4 w-4 ${showDetails ? "rotate-90" : ""}`}
                      />
                    </Button>
                    {showDetails && (
                      <pre className="p-4 bg-muted rounded-lg text-left text-sm overflow-auto w-full">
                        <code>
                          {JSON.stringify(
                            {
                              error,
                              message,
                            },
                            null,
                            2
                          )}
                        </code>
                      </pre>
                    )}
                  </>
                )}
              </>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
