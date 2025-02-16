"use client";
import { useState } from "react";
import { AUTH_CONFIG } from "@/config/auth";
import { TTwoFactorMethod } from "@/types/auth";
import { QrCodeIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TwoFactorVerifyForm } from "./2fa-verify-form";
import { useUserStore } from "@/store/user-store";
import { TwoFactorSetupDialog } from "./2fa-setup-dialog";

interface TwoFactorMethodsProps {
  enabledMethods: TTwoFactorMethod[];
  onMethodSetup: (method: TTwoFactorMethod, phone?: string) => Promise<void>;
  onMethodDisable: (method: TTwoFactorMethod, code: string) => Promise<void>;
  onVerify: (
    method: TTwoFactorMethod,
    code: string,
    phone?: string
  ) => Promise<void>;
  qrCode?: string;
  secret?: string;
  isVerifying?: boolean;
  verificationError?: string | null;
}

export function TwoFactorMethods({
  enabledMethods,
  onMethodSetup,
  onMethodDisable,
  onVerify,
  qrCode,
  secret,
  isVerifying = false,
  verificationError = null,
}: TwoFactorMethodsProps) {
  const { getFactorForMethod } = useUserStore();

  // Core states
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [methodToDisable, setMethodToDisable] = useState<{
    type: TTwoFactorMethod;
    factorId: string;
  } | null>(null);

  // Loading states
  const [isMethodLoading, setIsMethodLoading] = useState<
    Record<string, boolean>
  >({});

  const handleMethodToggle = async (
    method: TTwoFactorMethod,
    shouldEnable: boolean
  ) => {
    try {
      setIsMethodLoading((prev) => ({ ...prev, [method]: true }));

      if (shouldEnable) {
        setSelectedMethod(method);
        if (method === "authenticator") {
          await onMethodSetup(method);
        }
        setShowSetupDialog(true);
      } else {
        const factor = await getFactorForMethod(method);
        if (!factor) {
          toast.error("Error", { description: "2FA method not found" });
          return;
        }

        setMethodToDisable({
          type: method,
          factorId: factor.factorId,
        });
        setShowDisableDialog(true);
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update 2FA method. Please try again.",
      });
    } finally {
      setIsMethodLoading((prev) => ({ ...prev, [method]: false }));
    }
  };

  const handleDisableVerify = async (code: string) => {
    if (!methodToDisable) return;

    try {
      await onMethodDisable(methodToDisable.type, code);
      setShowDisableDialog(false);
      setMethodToDisable(null);
    } catch (error) {
      console.error("Error disabling 2FA:", error);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {AUTH_CONFIG.twoFactorAuth.methods
          .filter((method) => method.enabled)
          .map((method) => (
            <MethodCard
              key={method.type}
              method={method}
              isEnabled={enabledMethods.includes(method.type)}
              isLoading={isMethodLoading[method.type]}
              onToggle={handleMethodToggle}
            />
          ))}
      </div>

      {selectedMethod && (
        <TwoFactorSetupDialog
          open={showSetupDialog}
          onOpenChange={setShowSetupDialog}
          method={selectedMethod}
          onSetup={onMethodSetup}
          onVerify={onVerify}
          qrCode={qrCode}
          secret={secret}
          isVerifying={isVerifying}
          verificationError={verificationError}
        />
      )}

      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Please verify your identity to disable{" "}
              {methodToDisable?.type === "authenticator"
                ? "authenticator app"
                : "SMS"}{" "}
              authentication.
            </DialogDescription>
          </DialogHeader>
          {methodToDisable && (
            <TwoFactorVerifyForm
              factorId={methodToDisable.factorId}
              availableMethods={[methodToDisable]}
              onVerify={handleDisableVerify}
              isVerifying={isVerifying}
              error={verificationError}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Optional: Extract method card to its own component
function MethodCard({
  method,
  isEnabled,
  isLoading,
  onToggle,
}: {
  method: (typeof AUTH_CONFIG.twoFactorAuth.methods)[number];
  isEnabled: boolean;
  isLoading: boolean;
  onToggle: (method: TTwoFactorMethod, shouldEnable: boolean) => Promise<void>;
}) {
  const methodIcons: Record<TTwoFactorMethod, React.ReactNode> = {
    authenticator: <QrCodeIcon className="h-6 w-6" />,
    sms: <MessageCircleIcon className="h-6 w-6" />,
  };

  return (
    <div className="flex items-center justify-between border p-4 px-6 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
          {methodIcons[method.type]}
        </div>
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold">{method.title}</h3>
          <p className="text-sm text-muted-foreground">{method.description}</p>
        </div>
      </div>
      <Switch
        checked={isEnabled}
        onCheckedChange={(checked) => onToggle(method.type, checked)}
        disabled={isLoading}
      />
    </div>
  );
}
