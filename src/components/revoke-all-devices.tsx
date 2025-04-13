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

export function LogoutAllDevices() {
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoutAllDevices = async ({
    skipVerificationCheck = false,
  }: {
    skipVerificationCheck?: boolean;
  } = {}) => {
    try {
      setIsLoading(true);

      if (!skipVerificationCheck) {
        // Check if verification is needed
        const data = await api.auth.device.revokeAllDeviceSessions({
          checkVerificationOnly: true,
        });

        if (
          data.requiresVerification &&
          data.availableMethods &&
          data.availableMethods.length > 0
        ) {
          setVerificationData({ availableMethods: data.availableMethods });
          setNeedsVerification(true);
          return;
        }
      }

      // Verification completed/not needed -> proceed with logout
      await api.auth.device.revokeAllDeviceSessions({});

      toast.success("Successfully logged out all other devices");

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
              onVerifyComplete={() =>
                handleLogoutAllDevices({ skipVerificationCheck: true })
              }
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
