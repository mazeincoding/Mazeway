/**
 * This page is for non-authenticated users
 * It's where they'll enter their new password
 * Which will call /api/auth/reset-password
 */

"use client";
import { BackButton } from "@/components/back-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { validatePassword } from "@/utils/validation/auth-validation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (password !== confirmPassword) {
        setError("Passwords don't match");
        return;
      }

      const validation = validatePassword(password);
      if (!validation.isValid) {
        setError(validation.error || "Invalid password");
        return;
      }

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to reset password");
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      setError("An error occurred while resetting your password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 pb-0">
        <BackButton />
      </div>
      <main className="flex-grow flex justify-center items-center px-8 py-10">
        <Card className="w-full max-w-md">
          {isSuccess ? (
            <>
              <CardHeader>
                <div className="flex flex-col items-center gap-4">
                  <CheckCircle2 className="w-24 h-24 text-green-500" />
                  <CardTitle className="text-3xl font-bold text-center">
                    Success!
                  </CardTitle>
                  <CardDescription className="text-center text-base">
                    Your password has been changed. You can now log in with your
                    new password.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/auth/login" className="block w-full">
                  <Button className="w-full">Go to login</Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Enter your new password
                </CardTitle>
                <CardDescription>
                  This is the password you'll use in the future to log in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-4">
                    <Input
                      type="password"
                      placeholder="New password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <Input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Resetting password..." : "Reset password"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
