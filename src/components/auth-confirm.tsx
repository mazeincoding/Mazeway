import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { resendConfirmation } from "@/actions/auth/email";
import { toast } from "@/hooks/use-toast";

interface ConfirmProps {
  email: string;
  show: boolean;
  onClose: () => void;
  isError?: boolean;
  errorType?: string | null;
}

type ButtonConfig = {
  text: string;
  action: () => void;
  showTimer?: boolean;
};

type ErrorConfig = {
  title: string;
  message: string;
  canResend: boolean;
};

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
  confirm_expired: {
    title: "Link expired",
    message: "Your confirmation link has expired.",
    canResend: true,
  },
  missing_params: {
    title: "Invalid link",
    message: "The confirmation link is invalid or incomplete.",
    canResend: false,
  },
  confirm_invalid: {
    title: "Link already used",
    message: "This confirmation link is invalid or has already been used.",
    canResend: true,
  },
  profile_creation_failed: {
    title: "Profile creation failed",
    message:
      "Your email was verified, but we couldn't create your profile. Please try logging in - if the problem persists, contact support.",
    canResend: false,
  },
  failed_to_create_user: {
    title: "Failed to create user",
    message:
      "We were unable to create your user. Try refreshing the page and signing up again. If that doesn't work, contact support.",
    canResend: false,
  },
  google_callback_error: {
    title: "Google sign-in failed",
    message: "There was a problem signing in with Google. Please try again.",
    canResend: false,
  },
};

function getButtonConfig(
  errorType: string | null,
  email: string | undefined,
  handleResend: () => void,
  timeLeft: number,
  isResending: boolean
): ButtonConfig {
  if (!errorType && email) {
    return {
      text: isResending
        ? "Resending..."
        : timeLeft > 0
          ? `Send link again in ${timeLeft} seconds`
          : "Send link again",
      action: handleResend,
      showTimer: true,
    };
  }

  switch (errorType) {
    case "missing_params":
      return {
        text: "Go home",
        action: () => (window.location.href = "/"),
      };

    case "google_callback_error":
      return {
        text: "Try again",
        action: () => (window.location.href = "/auth/signup"),
      };

    case "failed_to_create_user":
      return {
        text: "Try again",
        action: () => (window.location.href = "/auth/signup"),
      };

    default:
      return {
        text: "Send link again",
        action: handleResend,
        showTimer: true,
      };
  }
}

function getErrorConfig(errorType: string | null): ErrorConfig {
  if (!errorType) {
    return {
      title: "Unable to confirm email",
      message: "Something went wrong while confirming your email.",
      canResend: true,
    };
  }

  return (
    ERROR_CONFIGS[errorType] || {
      title: "Unable to confirm email",
      message: "Something went wrong while confirming your email.",
      canResend: true,
    }
  );
}

export function Confirm({
  email,
  show,
  onClose,
  isError,
  errorType,
}: ConfirmProps) {
  const [timeLeft, setTimeLeft] = useState(isError ? 0 : 10);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!show) return;

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [show]);

  async function handleResend() {
    if (!email) return;

    setIsResending(true);
    const response = await resendConfirmation(email);

    if (response.error) {
      toast({
        title: "Error resending email",
        description: response.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email sent",
        description: "Check your inbox for the confirmation link",
      });
      setTimeLeft(10);
    }

    setIsResending(false);
  }

  function renderActionButton() {
    if (!isError && !email) {
      return (
        <Button
          className="bg-transparent hover:bg-transparent h-auto w-auto text-muted-foreground hover:text-foreground p-0"
          onClick={() => window.location.reload()}
        >
          Refresh page
        </Button>
      );
    }

    const config = getButtonConfig(
      errorType ?? null,
      email,
      handleResend,
      timeLeft,
      isResending
    );

    return (
      <Button
        className="bg-transparent hover:bg-transparent h-auto w-auto text-muted-foreground hover:text-foreground p-0"
        onClick={config.action}
        disabled={config.showTimer && (timeLeft > 0 || isResending)}
      >
        {isResending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Resending...
          </span>
        ) : (
          config.text
        )}
      </Button>
    );
  }

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-200 ease-in-out backdrop-blur-xl ${
        show ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
    >
      <div
        className={`space-y-4 flex flex-col items-center justify-center max-w-lg mx-auto text-center relative transition-all duration-200 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-3xl font-bold">
          {isError
            ? getErrorConfig(errorType ?? null).title
            : "Confirm your email"}
        </h1>
        <p className="text-muted-foreground text-lg">
          {isError ? (
            <>
              {getErrorConfig(errorType ?? null).message}
              {getErrorConfig(errorType ?? null).canResend &&
                " You can request a new confirmation email below."}
            </>
          ) : email ? (
            <>
              Just sent a confirmation email to{" "}
              <strong className="text-foreground">{email}</strong>. Click the
              link inside to finish setting up your account.
            </>
          ) : (
            "It seems like no email was provided. Try refreshing the page and signing up again."
          )}
        </p>
        {renderActionButton()}
      </div>
      {!isError && (
        <button
          onClick={onClose}
          className="bg-transparent absolute top-6 right-6 group h-auto w-auto"
        >
          <X className="text-muted-foreground group-hover:text-foreground size-6" />
        </button>
      )}
    </div>
  );
}
