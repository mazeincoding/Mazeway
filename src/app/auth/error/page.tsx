"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Suspense } from "react";

type TErrorCategory =
  | "auth_confirm"
  | "confirm_expired"
  | "missing_params"
  | "confirm_invalid"
  | "profile_creation_failed"
  | "failed_to_create_user"
  | "google_callback_error"
  | "google_auth_disabled"
  | "github_callback_error"
  | "github_auth_disabled"
  | "failed_to_get_session"
  | "reset_password_error"
  | "invalid_callback";
interface TErrorConfig {
  title: string;
  message: string;
  actions: {
    label: string;
    href: string;
    type?: "default" | "secondary";
  }[];
}

const ERROR_CONFIGS: Record<TErrorCategory, TErrorConfig> = {
  auth_confirm: {
    title: "Error confirming email",
    message: "There was an error while confirming your email.",
    actions: [
      {
        label: "Resend email",
        href: "/auth/confirm",
        type: "default",
      },
      {
        label: "Go Home",
        href: "/",
        type: "secondary",
      },
    ],
  },
  confirm_expired: {
    title: "Your link has expired",
    message: "Your link is no longer valid. Please request a new link.",
    actions: [
      {
        label: "Resend email",
        href: "/auth/confirm",
        type: "default",
      },
      {
        label: "Go Home",
        href: "/",
        type: "secondary",
      },
    ],
  },
  missing_params: {
    title: "Invalid link",
    message: "The confirmation link is invalid or incomplete.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  confirm_invalid: {
    title: "Invalid link",
    message: "The confirmation link is invalid or incomplete.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  profile_creation_failed: {
    title: "Profile creation failed",
    message:
      "Your email was verified, but we couldn't create your profile. Please try logging in - if the problem persists, contact support.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  failed_to_create_user: {
    title: "Failed to create user",
    message:
      "We were unable to create your user. Try refreshing the page and signing up again. If that doesn't work, contact support.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  google_callback_error: {
    title: "Google sign-in failed",
    message: "There was a problem signing in with Google. Please try again.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  google_auth_disabled: {
    title: "Google sign-in unavailable",
    message: "Google authentication is currently disabled on this site.",
    actions: [
      {
        label: "Log in with email",
        href: "/auth/login",
        type: "default",
      },
      {
        label: "Go Home",
        href: "/",
        type: "secondary",
      },
    ],
  },
  github_callback_error: {
    title: "GitHub sign-in failed",
    message: "There was a problem signing in with GitHub. Please try again.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  github_auth_disabled: {
    title: "GitHub sign-in unavailable",
    message: "GitHub authentication is currently disabled on this site.",
    actions: [
      {
        label: "Log in with email",
        href: "/auth/login",
        type: "default",
      },
      {
        label: "Go Home",
        href: "/",
        type: "secondary",
      },
    ],
  },
  failed_to_get_session: {
    title: "Failed to get session",
    message: "There was a problem getting your session. Please try again.",
    actions: [
      {
        label: "Go Home",
        href: "/",
        type: "default",
      },
    ],
  },
  reset_password_error: {
    title: "Password reset failed",
    message: "There was a problem resetting your password. Please try again.",
    actions: [
      {
        label: "Try Again",
        href: "/auth/forgot-password",
        type: "default",
      },
      {
        label: "Go Home",
        href: "/",
        type: "secondary",
      },
    ],
  },
  invalid_callback: {
    title: "Invalid authentication callback",
    message:
      "The authentication callback request was invalid or malformed. Please try logging in again.",
    actions: [
      {
        label: "Log in",
        href: "/auth/login",
        type: "default",
      },
      {
        label: "Go Home",
        href: "/",
        type: "secondary",
      },
    ],
  },
};

const DEFAULT_ERROR: TErrorConfig = {
  title: "Something went wrong",
  message: "An unexpected error occurred. Please try again.",
  actions: [
    {
      label: "Go Home",
      href: "/",
    },
  ],
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error");
  const errorMessage = searchParams.get("message");
  const [showDetails, setShowDetails] = useState(false);

  const errorConfig = errorType
    ? ERROR_CONFIGS[errorType as TErrorCategory] || DEFAULT_ERROR
    : DEFAULT_ERROR;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-4 py-8 md:px-8 max-w-xl mx-auto">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{errorConfig.title}</CardTitle>
          <CardDescription className="text-pretty text-sm">
            {errorConfig.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="w-full flex flex-col gap-3">
            {errorConfig.actions.map((action) => (
              <Link key={action.href} href={action.href} className="w-full">
                <Button
                  variant={action.type === "default" ? "default" : "outline"}
                  className="w-full"
                >
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
        {errorMessage && (
          <CardFooter className="flex-col gap-2">
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {showDetails ? "Hide error details" : "See error details"}
                <ChevronRight
                  className={`h-4 w-4 ${showDetails ? "rotate-90" : ""}`}
                />
              </button>
              {showDetails && (
                <pre className="mt-4 p-4 bg-muted rounded-lg text-left text-sm overflow-auto w-full">
                  <code>
                    {JSON.stringify(
                      {
                        error: errorType,
                        message: errorMessage,
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              )}
            </>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default function ErrorPage() {
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
      <ErrorContent />
    </Suspense>
  );
}
