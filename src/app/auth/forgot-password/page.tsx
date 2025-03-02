"use client";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authSchema } from "@/utils/validation/auth-validation";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

// We only need the email field for forgot password
const forgotPasswordSchema = z.object({
  email: authSchema.shape.email,
});

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ForgotPasswordSchema) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 3000,
          });
          return;
        }

        throw new Error(data.error || "Failed to send reset email");
      }

      setIsSuccess(true);
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Something went wrong",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 pb-0">
        <BackButton />
      </div>
      <main className="flex-grow flex justify-center items-center px-8 py-10">
        <Card className="w-full max-w-md">
          {!isSuccess && (
            <CardHeader className="pb-0">
              <CardTitle className="text-2xl font-bold">
                Reset your password
              </CardTitle>
              <CardDescription>
                Enter your email and we'll send you instructions to reset your
                password
              </CardDescription>
            </CardHeader>
          )}
          <CardContent className="!p-6">
            {isSuccess ? (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="w-24 h-24 text-green-500" />
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-semibold">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We've sent you instructions to reset your password.
                  </p>
                </div>
                <Button onClick={() => setIsSuccess(false)} className="mt-2">
                  Didn't receive the email? Try again
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                  noValidate
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Enter your email"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? "Sending..." : "Send reset instructions"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
