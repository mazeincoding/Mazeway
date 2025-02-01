"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  validatePassword,
  validateEmail,
} from "@/utils/validation/auth-validation";
import { Confirm } from "./auth-confirm";
import { TwoFactorVerifyForm } from "./2fa-verify-form";
import { TTwoFactorMethod } from "@/types/auth";
import { AUTH_CONFIG } from "@/config/auth";
import { BackButton } from "./back-button";

export function AuthForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [availableMethods, setAvailableMethods] = useState<
    Array<{
      type: TTwoFactorMethod;
      factorId: string;
    }>
  >([]);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [determinedType, setDeterminedType] = useState<
    "login" | "signup" | null
  >(null);

  async function handleEmailCheck(email: string) {
    try {
      setIsPending(true);
      const response = await fetch("/api/auth/email/check", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || "Failed to check email");
        return;
      }

      setDeterminedType(data.exists ? "login" : "signup");
      setShowPasswordField(true);
    } catch (error) {
      setFormError("An unexpected error occurred");
    } finally {
      setIsPending(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    const emailValue = formData.get("email") as string;

    // Initial email-only check
    if (!showPasswordField) {
      const emailValidation = validateEmail(emailValue);
      if (!emailValidation.isValid) {
        setFormError(emailValidation.error || "Invalid email");
        return;
      }
      setFormError(null);
      await handleEmailCheck(emailValue);
      return;
    }

    // Full form submission
    if (determinedType === "login") {
      // For login, only check if fields are empty
      if (!email || !password) {
        setFormError("Please enter your email and password");
        return;
      }
    } else {
      // For signup, do full validation
      const passwordValidation = validatePassword(password);
      const emailValidation = validateEmail(email);
      if (!passwordValidation.isValid || !emailValidation.isValid) {
        setFormError(
          passwordValidation.error || emailValidation.error || "Invalid form"
        );
        return;
      }
    }
    setFormError(null);

    try {
      setIsPending(true);
      const response = await fetch(`/api/auth/email/${determinedType}`, {
        method: "POST",
        body: JSON.stringify({
          email: email,
          password: password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      // If it's a redirect, follow it
      if (response.redirected || response.status === 307) {
        window.location.href = response.url;
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setFormError(
          data?.error ||
            "An unexpected error occurred. Refresh the page and try again."
        );
        return;
      }

      // Store redirect URL for later use
      setRedirectUrl(data?.redirectTo);

      // Check if 2FA is required
      if (data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setFactorId(data.factorId);
        setAvailableMethods(data.availableMethods || []);
        return;
      }

      // For signup, show confirmation dialog
      // For login, redirect to the URL from server
      if (determinedType === "signup") {
        setShowConfirm(true);
      } else {
        router.push(data?.redirectTo);
      }
    } catch (error) {
      setFormError(
        "An unexpected error occurred. Refresh the page and try again."
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerify(code: string) {
    if (!factorId || !redirectUrl) return;

    try {
      setIsPending(true);
      setTwoFactorError(null);

      const response = await fetch("/api/auth/2fa/verify", {
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

      const data = await response.json();

      if (!response.ok) {
        setTwoFactorError(data.error);
        return;
      }

      // Redirect to stored URL after successful 2FA
      router.push(redirectUrl);
    } catch (error) {
      setTwoFactorError("An unexpected error occurred");
    } finally {
      setIsPending(false);
    }
  }

  function handleMethodChange(method: {
    type: TTwoFactorMethod;
    factorId: string;
  }) {
    setFactorId(method.factorId);
    setTwoFactorError(null);
  }

  function handleBack() {
    if (!showPasswordField) {
      router.back();
      return;
    }

    setPassword("");
    setShowPasswordField(false);
    setDeterminedType(null);
    setFormError(null);
  }

  return (
    <>
      <div className="absolute top-0 left-0 p-4">
        <BackButton onClick={handleBack} />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-2xl font-bold">
              {requiresTwoFactor
                ? "Two-factor authentication"
                : showPasswordField
                  ? determinedType === "login"
                    ? "Welcome back"
                    : "Create your account"
                  : "Sign up or log in"}
            </CardTitle>
            <CardDescription className="text-foreground/35">
              {requiresTwoFactor
                ? availableMethods.length > 1
                  ? "Choose a verification method"
                  : availableMethods[0]?.type === "authenticator"
                    ? "Enter the code from your authenticator app"
                    : "Enter the code sent to your phone"
                : showPasswordField
                  ? determinedType === "login"
                    ? "Enter your password to continue"
                    : "Create a password to get started"
                  : "Enter your email to continue"}
            </CardDescription>
          </div>
          {!requiresTwoFactor && !showPasswordField && <SocialButtons />}
        </CardHeader>
        <CardContent>
          {requiresTwoFactor ? (
            factorId && (
              <TwoFactorVerifyForm
                factorId={factorId}
                availableMethods={availableMethods}
                onVerify={handleVerify}
                onMethodChange={handleMethodChange}
                isVerifying={isPending}
                error={twoFactorError}
              />
            )
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                await handleSubmit(formData);
              }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={
                        determinedType === "signup" &&
                        !!formError &&
                        !validateEmail(email).isValid
                      }
                      disabled={showPasswordField}
                    />
                    {showPasswordField && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent group"
                        onClick={handleBack}
                      >
                        <Pencil className="h-3 w-3 flex-shrink-0 text-foreground/50 transition-colors group-hover:text-foreground" />
                        <span className="sr-only">Edit email</span>
                      </Button>
                    )}
                  </div>
                </div>
                {showPasswordField && (
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
                      aria-invalid={
                        determinedType === "signup" &&
                        !!formError &&
                        !validatePassword(password).isValid
                      }
                    />
                  </div>
                )}

                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isPending ||
                    (showPasswordField &&
                      determinedType === "signup" &&
                      password.length <
                        AUTH_CONFIG.passwordRequirements.minLength)
                  }
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {showPasswordField
                        ? determinedType === "login"
                          ? "Logging in..."
                          : "Creating account..."
                        : "Continue"}
                    </span>
                  ) : showPasswordField ? (
                    determinedType === "login" ? (
                      "Log in"
                    ) : (
                      "Create account"
                    )
                  ) : (
                    "Continue"
                  )}
                </Button>
                {determinedType === "login" &&
                  showPasswordField &&
                  !requiresTwoFactor && (
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
          )}
        </CardContent>
        {!requiresTwoFactor && showPasswordField && (
          <CardFooter className="flex flex-col gap-2 border-t p-5">
            <p className="text-sm text-foreground/35 flex gap-1">
              {determinedType === "login" ? (
                <>
                  Don't have an account?{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setDeterminedType("signup");
                      setPassword("");
                      setFormError(null);
                    }}
                  >
                    Sign up
                  </Button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setDeterminedType("login");
                      setPassword("");
                      setFormError(null);
                    }}
                  >
                    Log in
                  </Button>
                </>
              )}
            </p>
          </CardFooter>
        )}
      </Card>
      <Confirm
        email={email}
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
      />
    </>
  );
}

export function SocialButtons() {
  const [isPending, setIsPending] = useState(false);

  /**
   * Handles Google sign-in flow:
   * 1. Calls our API to initiate OAuth
   * 2. API returns Google's consent URL
   * 3. Redirects client to Google (needs to be client-side for OAuth flow)
   * 4. After consent, Google redirects back to our callback URL
   */
  async function handleGoogleSignIn() {
    try {
      setIsPending(true);
      const response = await fetch("/api/auth/google/signin", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error("Error", {
          description: data.error,
          duration: 3000,
        });
        return;
      }

      // Redirect to Google's consent page
      if (data.url) {
        window.location.href = data.url;
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
