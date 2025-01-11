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
import { toast } from "sonner";
import {
  validatePassword,
  validateEmail,
} from "@/utils/validation/auth-validation";
import { Confirm } from "./auth-confirm";
import { signInWithGoogle } from "@/actions/auth/google";

interface AuthFormProps {
  type: "login" | "signup";
}

export function AuthForm({ type }: AuthFormProps) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordValidation = validatePassword(password);
  const emailValidation = validateEmail(email);

  async function handleSubmit(formData: FormData) {
    const response =
      type === "login" ? await login(formData) : await signup(formData);

    if (response.error) {
      toast.error("Error", {
        description: response.error,
        duration: 3000,
      });
    } else if (type === "signup") {
      setShowConfirm(true);
    }
  }

  const isFormValid = passwordValidation.isValid && emailValidation.isValid;

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-2xl font-bold">
              {type === "login" ? "Welcome back" : "Create your account"}
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
          <form action={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-4">
              <SubmitButton type={type} disabled={!isFormValid} />
              {type === "login" && (
                <Link href="/auth/login-help">
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full text-sm"
                  >
                    Can't log in?
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t p-5">
          <p className="text-sm text-foreground/35 flex gap-1">
            {type === "login" ? (
              <>
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="text-foreground hover:underline"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-foreground hover:underline"
                >
                  Log in
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </Card>
      <Confirm
        email={email}
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
      />
    </>
  );
}

function SubmitButton({
  type,
  disabled,
}: {
  type: "login" | "signup";
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={disabled || pending}>
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
  const [isPending, setIsPending] = useState(false);

  async function handleGoogleSignIn() {
    try {
      setIsPending(true);
      const response = await signInWithGoogle();

      if (response.error) {
        toast.error("Error", {
          description: response.error,
          duration: 3000,
        });
      } else if (response.url) {
        window.location.href = response.url;
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      toast.error("Error", {
        description: "Failed to sign in with Google",
        duration: 3000,
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isPending}
      >
        <>
          <FaGoogle className="w-4 h-4" />
          Continue with Google
        </>
      </Button>
    </div>
  );
}
