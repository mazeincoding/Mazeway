"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIG } from "@/config/auth";
import { TTwoFactorMethod } from "@/types/auth";
import { Card } from "@/components/ui/card";
import {
  QrCodeIcon,
  MessageCircleIcon,
  ShieldIcon,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { TwoFactorSetupDialog } from "@/components/2fa-setup-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Manage2FADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledMethods: TTwoFactorMethod[];
  onMethodSetup: (method: TTwoFactorMethod) => Promise<void>;
  onMethodDisable: (
    method: TTwoFactorMethod,
    password: string
  ) => Promise<void>;
  onDisableAll: (password: string) => Promise<void>;
}

export function Manage2FADialog({
  open,
  onOpenChange,
  enabledMethods,
  onMethodSetup,
  onMethodDisable,
  onDisableAll,
}: Manage2FADialogProps) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );
  const [isDisabling, setIsDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [isDisablingAll, setIsDisablingAll] = useState(false);

  const methodIcons: Record<TTwoFactorMethod, React.ReactNode> = {
    authenticator: <QrCodeIcon className="h-5 w-5" />,
    sms: <MessageCircleIcon className="h-5 w-5" />,
  };

  const handleMethodAction = async (
    method: TTwoFactorMethod,
    isEnabled: boolean
  ) => {
    try {
      if (isEnabled) {
        setSelectedMethod(method);
        setIsDisablingAll(false);
        setShowPasswordDialog(true);
      } else {
        await onMethodSetup(method);
        setSelectedMethod(method);
        setShowSetupDialog(true);
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update 2FA method. Please try again.",
      });
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      setIsDisabling(true);
      if (isDisablingAll) {
        await onDisableAll(password);
        onOpenChange(false);
      } else if (selectedMethod) {
        await onMethodDisable(selectedMethod, password);
      }
      setShowPasswordDialog(false);
      setPassword("");
    } catch (error) {
      toast.error("Error", {
        description: "Failed to disable 2FA. Please try again.",
      });
    } finally {
      setIsDisabling(false);
    }
  };

  const handleDisableAll = () => {
    setIsDisablingAll(true);
    setShowPasswordDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              {enabledMethods.length > 0
                ? "Manage your two-factor authentication methods."
                : "Add an extra layer of security to your account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {AUTH_CONFIG.twoFactorAuth.methods
              .filter((method) => method.enabled)
              .map((method) => {
                const isEnabled = enabledMethods.includes(method.type);
                return (
                  <Card
                    key={method.type}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {methodIcons[method.type]}
                      </div>
                      <div>
                        <h4 className="font-medium">{method.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {method.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={isEnabled ? "outline" : "default"}
                      onClick={() => handleMethodAction(method.type, isEnabled)}
                    >
                      {isEnabled ? "Disable" : "Enable"}
                    </Button>
                  </Card>
                );
              })}
          </div>

          {enabledMethods.length > 0 && (
            <>
              <Separator className="my-4" />
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Disabling all 2FA methods will make your account less secure.
                </AlertDescription>
              </Alert>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDisableAll}
                disabled={isDisabling}
              >
                {isDisabling
                  ? "Disabling..."
                  : "Disable Two-Factor Authentication"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Verify Password
            </DialogTitle>
            <DialogDescription>
              Please enter your password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <Button
              className="w-full"
              onClick={handlePasswordSubmit}
              disabled={!password || isDisabling}
            >
              {isDisabling ? "Verifying..." : "Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedMethod && (
        <TwoFactorSetupDialog
          open={showSetupDialog}
          onOpenChange={(open) => {
            setShowSetupDialog(open);
            if (!open) setSelectedMethod(null);
          }}
          qrCode=""
          secret=""
          onVerify={async () => {}}
          isVerifying={false}
          error={null}
        />
      )}
    </>
  );
}
