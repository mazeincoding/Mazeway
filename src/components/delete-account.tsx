import { useState } from "react";
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

export default function DeleteAccount({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      // Try to delete account
      const data = await api.auth.deleteAccount();

      // If verification is needed, show verification form
      if (
        data.requiresTwoFactor ||
        (data.availableMethods && data.availableMethods.length > 0)
      ) {
        if (data.availableMethods) {
          setVerificationData({
            availableMethods: data.availableMethods,
          });
          return;
        }
      }

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
      setIsDeleting(false);
    }
  };

  const handleVerify = async (code: string, factorId: string) => {
    try {
      setIsDeleting(true);
      setError(null);

      if (!verificationData) return;

      // Verify using the centralized verify endpoint
      await api.auth.verify({
        factorId,
        method: verificationData.availableMethods[0].type,
        code,
      });

      // After verification, try to delete account again
      await handleDelete();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Verification failed");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to proceed?
          </DialogDescription>
        </DialogHeader>

        {verificationData ? (
          <VerifyForm
            availableMethods={verificationData.availableMethods}
            onVerify={handleVerify}
            isVerifying={isDeleting}
            error={error}
          />
        ) : (
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
