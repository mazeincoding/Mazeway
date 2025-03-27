"use client";
import { Suspense } from "react";
import { useState, useMemo, useEffect } from "react";
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
import { FaGoogle, FaGithub } from "react-icons/fa";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { validatePassword, validateEmail } from "@/validation/auth-validation";
import { Confirm } from "./auth-confirm";
import { VerifyForm } from "./verify-form";
import { TTwoFactorMethod, TVerificationFactor } from "@/types/auth";
import { AUTH_CONFIG } from "@/config/auth";
import { BackButton } from "./back-button";
import { api } from "@/utils/api";
import Link from "next/link";

type AuthFormProps = {
  requires2fa?: boolean;
  initialFactorId?: string | null;
  nextUrl?: string;
  initialMethods?: Array<{ type: TTwoFactorMethod; factorId: string }>;
  message?: string | null;
  initialEmail?: string | null;
};

export function AuthForm({
  requires2fa = false,
  initialFactorId = null,
  nextUrl = "/dashboard",
  initialMethods = [],
  message,
  initialEmail = null,
}: AuthFormProps) {
  const router = useRouter();

  // Show message from props
  useEffect(() => {
    if (message) {
      // Small delay to ensure the toast is shown after hydration
      const timer = setTimeout(() => {
        toast.info(message);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const initialTwoFactorState = useMemo(() => {
    return {
      requiresTwoFactor: requires2fa && !!initialFactorId,
      factorId: initialFactorId || null,
      redirectUrl: nextUrl,
      availableMethods: initialMethods,
    };
  }, [requires2fa, initialFactorId, nextUrl, initialMethods]);

  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(initialEmail || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(
    initialTwoFactorState.requiresTwoFactor
  );
  const [factorId, setFactorId] = useState<string | null>(
    initialTwoFactorState.factorId
  );
  const [availableMethods, setAvailableMethods] = useState<
    TVerificationFactor[]
  >(
    initialTwoFactorState.availableMethods.map((m) => ({
      ...m,
      type: m.type as TTwoFactorMethod,
    }))
  );
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(
    initialTwoFactorState.redirectUrl
  );
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [determinedType, setDeterminedType] = useState<
    "login" | "signup" | null
  >(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleEmailCheck(email: string) {
    try {
      setIsPending(true);
      const data = await api.auth.checkEmail(email);
      setDeterminedType(data.exists ? "login" : "signup");
      setShowPasswordField(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
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
    if (!determinedType) {
      setFormError("Please check your email first");
      return;
    }

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

      if (determinedType === "login") {
        const result = await api.auth.login({ email, password });
        // If null, the API client handled the redirect
        if (!result) return;

        // Handle 2FA
        if (result.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setFactorId(result.availableMethods?.[0]?.factorId ?? null);
          setAvailableMethods(result.availableMethods ?? []);
          setRedirectUrl(result.redirectTo);
          return;
        }
      } else {
        // Handle signup
        await api.auth.signup({ email, password });
        setShowConfirm(true);
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerify(code: string, factorId: string) {
    if (!redirectUrl) return;

    try {
      setIsPending(true);
      setTwoFactorError(null);

      await api.auth.verify({
        factorId,
        code,
        method:
          availableMethods.find((m) => m.factorId === factorId)?.type ||
          "authenticator",
      });

      // Redirect to stored URL after successful 2FA
      router.push(redirectUrl);
    } catch (error) {
      setTwoFactorError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsPending(false);
    }
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
                ? factorId &&
                  availableMethods.find((m) => m.factorId === factorId)
                    ?.type === "authenticator"
                  ? "Enter the code from your authenticator app"
                  : factorId &&
                      availableMethods.find((m) => m.factorId === factorId)
                        ?.type === "backup_codes"
                    ? "Enter a backup code"
                    : factorId &&
                        availableMethods.find((m) => m.factorId === factorId)
                          ?.type === "sms"
                      ? "Enter the code sent to your phone"
                      : availableMethods.length > 1
                        ? "Choose a verification method"
                        : "Enter verification code"
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
              <VerifyForm
                availableMethods={availableMethods}
                onVerify={handleVerify}
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
                      className={showPasswordField ? "pr-10" : ""}
                    />
                    {showPasswordField && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={handleBack}
                      >
                        <Pencil className="h-4 w-4" />
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
                      showPassword={showPassword}
                      onShowPasswordChange={setShowPassword}
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
      const data = await api.auth.googleSignIn();

      // Redirect to Google's consent page
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      toast.error("Error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to sign in with Google",
        duration: 3000,
      });
    } finally {
      setIsPending(false);
    }
  }

  async function handleGithubSignIn() {
    try {
      setIsPending(true);
      const data = await api.auth.githubSignIn();

      // Redirect to GitHub's consent page
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("GitHub sign in error:", error);
      toast.error("Error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to sign in with GitHub",
        duration: 3000,
      });
    } finally {
      setIsPending(false);
    }
  }

  // If both providers are disabled, don't render anything
  if (
    !AUTH_CONFIG.socialProviders.google.enabled &&
    !AUTH_CONFIG.socialProviders.github.enabled
  ) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {AUTH_CONFIG.socialProviders.google.enabled && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isPending}
        >
          <FaGoogle className="w-4 h-4" />
          {!AUTH_CONFIG.socialProviders.github.enabled
            ? "Continue with Google"
            : "Google"}
        </Button>
      )}
      {AUTH_CONFIG.socialProviders.github.enabled && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGithubSignIn}
          disabled={isPending}
        >
          <FaGithub className="w-4 h-4" />
          {!AUTH_CONFIG.socialProviders.google.enabled
            ? "Continue with GitHub"
            : "GitHub"}
        </Button>
      )}
    </div>
  );
}
