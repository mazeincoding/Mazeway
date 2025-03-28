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
import { useState, Suspense } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { VerifyForm } from "@/components/verify-form";
import { TVerificationFactor } from "@/types/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authSchema } from "@/validation/auth-validation";
import { toast } from "sonner";

// Schema for reset password form
const resetPasswordSchema = z
  .object({
    password: authSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requires2FA, setRequires2FA] = useState(
    searchParams.get("requires_2fa") === "true"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(
    searchParams.get("factor_id")
  );
  const [availableMethods, setAvailableMethods] = useState<
    TVerificationFactor[]
  >(() => {
    const methods = searchParams.get("available_methods");
    return methods ? JSON.parse(methods) : [];
  });
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/dashboard");

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleVerify = async (code: string) => {
    if (!factorId) return;

    try {
      setLoading(true);
      setTwoFactorError(null);

      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          factorId,
          code,
          method:
            availableMethods.find((m) => m.factorId === factorId)?.type ||
            "authenticator",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setTwoFactorError(data.error);
        return;
      }

      // After successful 2FA, show password form
      setRequires2FA(false);
    } catch (error) {
      setTwoFactorError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: ResetPasswordSchema) => {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresTwoFactor) {
          setRequires2FA(true);
          setFactorId(data.factorId);
          setAvailableMethods(data.availableMethods || []);
          return;
        }

        throw new Error(data.error || "Failed to reset password");
      }

      setIsSuccess(true);
      setLoginRequired(data.loginRequired);
      setRedirectTo(data.redirectTo);
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Something went wrong",
      });
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
                    {loginRequired
                      ? "Your password has been changed. Please log in with your new password."
                      : "Your password has been changed. Continue with using the app."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={redirectTo} className="block w-full">
                  <Button className="w-full">
                    {loginRequired ? "Log in" : "Continue"}
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : requires2FA ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Two-factor authentication
                </CardTitle>
                <CardDescription>
                  {availableMethods.length > 1
                    ? "Choose a verification method"
                    : availableMethods[0]?.type === "authenticator"
                      ? "Enter the code from your authenticator app"
                      : "Enter the code sent to your phone"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {factorId && (
                  <VerifyForm
                    availableMethods={availableMethods}
                    onVerify={handleVerify}
                    isVerifying={loading}
                    error={twoFactorError}
                    setError={setTwoFactorError}
                  />
                )}
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
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                    noValidate
                  >
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="New password"
                              {...field}
                              disabled={loading}
                              showPassword={showPassword}
                              onShowPasswordChange={setShowPassword}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirm password"
                              {...field}
                              disabled={loading}
                              showPassword={showPassword}
                              onShowPasswordChange={setShowPassword}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Resetting password..." : "Reset password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md p-6">
            <CardHeader>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
