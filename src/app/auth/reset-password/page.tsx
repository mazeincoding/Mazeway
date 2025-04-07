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
import {
  resetPasswordSchema,
  ResetPasswordSchema,
} from "@/validation/auth-validation";
import { toast } from "sonner";
import { api } from "@/utils/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requires2FA, setRequires2FA] = useState(
    searchParams.get("requires_2fa") === "true"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(() => {
    const methods = searchParams.get("available_methods");
    return methods ? { availableMethods: JSON.parse(methods) } : null;
  });
  const [loginRequired, setLoginRequired] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/dashboard");

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const handleResetPassword = async () => {
    try {
      setIsLoading(true);
      console.log("Resetting password");

      const isValid = await form.trigger();
      if (!isValid) {
        console.log("Invalid form");
        setIsLoading(false);
        return;
      }

      const values = form.getValues();
      console.log("Values", values);

      const data = await api.auth.resetPassword({
        password: values.password,
      });

      console.log("Data", data);

      if (data.requiresTwoFactor && data.availableMethods) {
        console.log("Requires 2FA", data);
        setTwoFactorData({ availableMethods: data.availableMethods });
        setRequires2FA(true);
        return;
      }

      console.log("Success", data);
      setIsSuccess(true);
      setLoginRequired(data.loginRequired || false);
      setRedirectTo(data.redirectTo || "/dashboard");
      setRequires2FA(false);
      setTwoFactorData(null);
    } catch (error) {
      console.log("Error", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      console.log("Finally");
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    setRequires2FA(false);
    form.reset({
      password: "",
      confirmPassword: "",
    });
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
          ) : requires2FA && twoFactorData ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Two-factor authentication
                </CardTitle>
                <CardDescription>
                  For your security, please verify your identity before
                  resetting your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VerifyForm
                  availableMethods={twoFactorData.availableMethods}
                  onVerifyComplete={handleVerificationComplete}
                />
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
                    onSubmit={form.handleSubmit(handleResetPassword)}
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
                              disabled={isLoading}
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
                              disabled={isLoading}
                              showPassword={showPassword}
                              onShowPasswordChange={setShowPassword}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        isLoading ||
                        !form.formState.isValid ||
                        Object.keys(form.formState.errors).length > 0
                      }
                    >
                      {isLoading ? "Resetting password..." : "Reset password"}
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
