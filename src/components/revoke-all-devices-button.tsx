"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TDeviceSession, TVerificationFactor } from "@/types/auth";
import { VerifyForm } from "./verify-form";
import { api } from "@/utils/api";

interface RevokeAllDevicesButtonProps {
  deviceSessions: TDeviceSession[];
  onSuccess: () => void;
}

export function RevokeAllDevicesButton({
  deviceSessions,
  onSuccess,
}: RevokeAllDevicesButtonProps) {
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);

  const handleRevokeAll = async () => {
    try {
      setIsRevokingAll(true);

      // First check if verification is needed
      const data = await api.auth.device.revokeAllSessions({
        checkVerificationOnly: true,
      });

      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({
          availableMethods: data.availableMethods,
        });
        return;
      }

      // If no verification needed, proceed with revocation
      const result = await api.auth.device.revokeAllSessions();

      toast.success("All devices logged out", {
        description: `Successfully logged out ${result.revokedCount || 0} device${result.revokedCount === 1 ? "" : "s"}.`,
        duration: 3000,
      });

      onSuccess();
      setShowRevokeAllDialog(false);
    } catch (error) {
      console.error("Error during bulk device revocation:", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsRevokingAll(false);
    }
  };

  const handleVerifyComplete = () => {
    // After verification is complete, proceed with the actual revocation
    handleRevokeAll();
    setVerificationData(null);
  };

  if (deviceSessions.length <= 1) {
    return null;
  }

  return (
    <div>
      <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <DialogTrigger asChild>
          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {deviceSessions.length} devices
            </p>

            <Button variant="destructive">Log out all devices</Button>
          </div>
        </DialogTrigger>
        <DialogContent>
          {verificationData ? (
            <>
              <DialogHeader>
                <DialogTitle>Verification Required</DialogTitle>
                <DialogDescription>
                  For security reasons, please verify your identity before
                  logging out all devices.
                </DialogDescription>
              </DialogHeader>
              <VerifyForm
                availableMethods={verificationData.availableMethods}
                onVerifyComplete={handleVerifyComplete}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Log out all devices?</DialogTitle>
                <DialogDescription>
                  This will log out all devices except your current one. This
                  action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRevokeAllDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRevokeAll}
                  disabled={isRevokingAll}
                >
                  {isRevokingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging out...
                    </>
                  ) : (
                    "Log out all devices"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
