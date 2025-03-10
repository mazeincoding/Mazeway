import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { api } from "@/utils/api";

interface ConfirmProps {
  email: string;
  show: boolean;
  onClose: () => void;
}

export function Confirm({ email, show, onClose }: ConfirmProps) {
  const [timeLeft, setTimeLeft] = useState(10);
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
    try {
      await api.auth.resendConfirmation(email);

      toast.success("Email sent", {
        description: "Check your inbox for the confirmation link",
        duration: 3000,
      });
      setTimeLeft(10);
    } catch (error) {
      toast.error("Error resending email", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        duration: 3000,
      });
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-200 ease-in-out backdrop-blur-2xl ${
        show ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
    >
      <div
        className={`space-y-4 flex flex-col items-center justify-center max-w-lg mx-auto text-center relative transition-all duration-200 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-3xl font-bold">Confirm your email</h1>
        <p className="text-muted-foreground text-lg">
          {email ? (
            <>
              We have sent a confirmation email to{" "}
              <strong className="text-foreground">{email}</strong>. Click the
              link inside to finish setting up your account.
            </>
          ) : (
            "No email was provided. Please try again."
          )}
        </p>
        {email && (
          <Button
            className="bg-transparent hover:bg-transparent h-auto w-auto text-muted-foreground hover:text-foreground p-0 shadow-none"
            onClick={handleResend}
            disabled={timeLeft > 0 || isResending}
          >
            {isResending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Resending...
              </span>
            ) : timeLeft > 0 ? (
              `Send link again in ${timeLeft} seconds`
            ) : (
              "Send link again"
            )}
          </Button>
        )}
      </div>
      <button
        onClick={onClose}
        className="bg-transparent absolute top-6 right-6 group h-auto w-auto"
      >
        <X className="text-muted-foreground group-hover:text-foreground size-6" />
      </button>
    </div>
  );
}
