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
import { useDeviceSessions } from "@/hooks/use-device-sessions";

export function LogoutAllDevices() {
  const { refresh } = useDeviceSessions();
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoutAllDevices = async () => {
    try {
      setIsLoading(true);

      // Attempt to revoke all sessions
      const data = await api.auth.device.revokeSession({
        revokeAll: true,
      });

      // If verification is needed, show dialog
      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({ availableMethods: data.availableMethods });
        setNeedsVerification(true);
        return;
      }

      // Verification completed/not needed -> proceed with logout
      toast.success("Successfully logged out all other devices");
      refresh();

      setNeedsVerification(false);
      setVerificationData(null);
    } catch (error) {
      console.error("Error logging out all devices", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => handleLogoutAllDevices()}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "Logout all devices"}
      </Button>

      {verificationData && verificationData.availableMethods && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                To logout all other devices, please verify your identity
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={verificationData.availableMethods}
              onVerifyComplete={() => handleLogoutAllDevices()}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
