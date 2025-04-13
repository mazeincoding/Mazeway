"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VerifyForm } from "@/components/verify-form";
import { TVerificationFactor } from "@/types/auth";
import { api } from "@/utils/api";
import { useState } from "react";
import { toast } from "sonner";

export default function VerificationExample() {
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);

      // Attempt to delete account
      const data = await api.auth.deleteAccount();

      // If verification is needed, show verification dialog
      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({ availableMethods: data.availableMethods });
        setNeedsVerification(true);
        return;
      }

      toast.success("Account deleted successfully");
    } catch (error) {
      console.error("Error during account deletion", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
      setNeedsVerification(false);
      setVerificationData(null);
    }
  };

  return (
    <div>
      <Button
        variant="destructive"
        onClick={handleDeleteAccount}
        disabled={isDeleting}
      >
        Delete account
      </Button>
      {verificationData && verificationData.availableMethods && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                To delete your account, please verify your identity
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={verificationData.availableMethods}
              onVerifyComplete={handleDeleteAccount}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
