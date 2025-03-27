import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { VerifyForm } from "./verify-form";
import { TVerificationFactor } from "@/types/auth";
import { api } from "@/utils/api";

const DELETION_COUNTDOWN_SECONDS = 5;

export default function DeleteAccount({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [countdown, setCountdown] = useState(DELETION_COUNTDOWN_SECONDS);
  const [countdownStarted, setCountdownStarted] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdownStarted && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      handleFinalDelete();
    }
    return () => clearTimeout(timer);
  }, [countdown, countdownStarted]);

  const startDeletion = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      // Try to delete account
      const data = await api.auth.deleteAccount();

      // If verification is needed, show verification form
      if (
        data.requiresVerification ||
        (data.availableMethods && data.availableMethods.length > 0)
      ) {
        if (data.availableMethods) {
          setVerificationData({
            availableMethods: data.availableMethods,
          });
          return;
        }
      }

      // If no verification needed, show final confirmation
      setShowFinalConfirmation(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeletion = () => {
    setCountdownStarted(false);
    setCountdown(DELETION_COUNTDOWN_SECONDS);
    setShowFinalConfirmation(false);
  };

  const handleFinalDelete = async () => {
    try {
      setIsFinalizing(true);
      setError(null);

      // Try to delete account
      const data = await api.auth.deleteAccount();

      // Success - close dialog and clean up
      setIsOpen(false);

      // Show success message
      toast.success("Account deleted", {
        description: "Your account has been permanently deleted.",
      });

      // Clear any cached user data
      await api.auth.logout();

      // Small delay to ensure cleanup is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to home and force a hard refresh to clear all state
      window.location.href = "/";
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsFinalizing(false);
      setShowFinalConfirmation(false);
      setCountdownStarted(false);
      setCountdown(DELETION_COUNTDOWN_SECONDS);
    }
  };

  const handleVerify = async (code: string, factorId: string) => {
    try {
      setIsVerifying(true);
      setError(null);

      if (!verificationData) return;

      // Verify using the centralized verify endpoint
      await api.auth.verify({
        factorId,
        method: verificationData.availableMethods[0].type,
        code,
      });

      // After verification, show final confirmation
      setVerificationData(null);
      setShowFinalConfirmation(true);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Verification failed");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Compute overall loading state
  const isLoading = isVerifying || isFinalizing || isDeleting;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            {showFinalConfirmation
              ? "This is your final chance to keep your account."
              : "Are you sure you want to proceed?"}
          </DialogDescription>
        </DialogHeader>

        {verificationData ? (
          <VerifyForm
            availableMethods={verificationData.availableMethods}
            onVerify={handleVerify}
            isVerifying={isVerifying}
            error={error}
          />
        ) : showFinalConfirmation ? (
          <div className="space-y-4">
            <div
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
              role="alert"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="text-sm text-destructive font-medium">
                Your account will be permanently deleted in {countdown} seconds
              </p>
              {countdownStarted && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Cancel" to stop the deletion process
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="secondary"
                onClick={cancelDeletion}
                disabled={isLoading}
                aria-label="Cancel account deletion"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCountdownStarted(true)}
                disabled={isLoading || countdownStarted}
                aria-label={
                  countdownStarted
                    ? `Account deletion in progress, ${countdown} seconds remaining`
                    : "Start account deletion countdown"
                }
              >
                {countdownStarted
                  ? `Deleting in ${countdown}s...`
                  : "Yes, delete my account"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={startDeletion}
              disabled={isLoading}
              aria-label="Proceed to final account deletion confirmation"
            >
              {isDeleting ? "Processing..." : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
