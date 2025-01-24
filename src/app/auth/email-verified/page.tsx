"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function EmailVerifiedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to account page after 3 seconds
    const timeout = setTimeout(() => {
      router.push("/account");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <main className="flex-grow flex justify-center items-center px-8 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-24 h-24 text-green-500" />
            <CardTitle className="text-3xl font-bold text-center">
              Email Verified!
            </CardTitle>
            <CardDescription className="text-center text-base">
              Your new email address has been confirmed successfully.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to settings...
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
