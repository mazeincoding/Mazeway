"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FaGoogle } from "react-icons/fa";
import Link from "next/link";
import { login, signup } from "@/actions/auth/email";
import { useFormStatus } from "react-dom";
import { toast } from "@/hooks/use-toast";
import { GradientText } from "@/components/gradient-text";

interface AuthFormProps {
  type: "login" | "signup";
}

export function AuthForm({ type }: AuthFormProps) {
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setError(undefined);

    const response =
      type === "login" ? await login(formData) : await signup(formData);

    if (response.error) {
      setError(response.error);
      toast({
        title: "Error",
        description: response.error,
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-2xl font-bold">
            <GradientText>
              {type === "login" ? "Welcome back" : "Create your account"}
            </GradientText>
          </CardTitle>
          <CardDescription className="text-foreground/35">
            {type === "login"
              ? "Enter your credentials to continue"
              : "Enter your details below to get started"}
          </CardDescription>
        </div>
        <SocialButtons />
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <SubmitButton type={type} />
          {type === "login" && (
            <Link href="/login-help">
              <Button
                variant="outline"
                type="button"
                className="w-full text-sm"
              >
                Can't log in?
              </Button>
            </Link>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t p-5">
        <p className="text-sm text-foreground/35 flex gap-1">
          {type === "login" ? (
            <>
              Don't have an account?{" "}
              <Link href="/signup" className="text-foreground hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-foreground hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </CardFooter>
    </Card>
  );
}

function SubmitButton({ type }: { type: "login" | "signup" }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {type === "login" ? "Logging in..." : "Creating account..."}
        </span>
      ) : type === "login" ? (
        "Log in"
      ) : (
        "Create account"
      )}
    </Button>
  );
}

export function SocialButtons() {
  return (
    <div className="flex gap-2">
      <Button variant="outline" className="w-full">
        <FaGoogle className="w-4 h-4" />
        Continue with Google
      </Button>
    </div>
  );
}
