"use client";
import { useState } from "react";
import { TTwoFactorMethod, TVerificationFactor } from "@/types/auth";
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
import { VerifyForm } from "./verify-form";
import {
  getConfigured2FAMethods,
  getUserVerificationMethods,
} from "@/utils/auth";
import { TwoFactorSetupDialog } from "./2fa-setup-dialog";
import { createClient } from "@/utils/supabase/client";

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
  backupCodes?: string[];
  isVerifying?: boolean;
  verificationError?: string | null;
}

// State for disabling a 2FA method
interface DisableMethodState {
  methodToDisable: TTwoFactorMethod;
  userEnabledMethods: TVerificationFactor[];
  currentMethod: TVerificationFactor;
}

export function TwoFactorMethods({
  enabledMethods,
  onMethodSetup,
  onMethodDisable,
  onVerify,
  qrCode,
  secret,
  backupCodes,
  isVerifying = false,
  verificationError = null,
}: TwoFactorMethodsProps) {
  // Core states
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableState, setDisableState] = useState<DisableMethodState | null>(
    null
  );
  const supabase = createClient();

  // Loading states
  const [isMethodLoading, setIsMethodLoading] = useState<
    Record<string, boolean>
  >({});
  const [isDisableVerifying, setIsDisableVerifying] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Get available 2FA methods from config
  const availableConfiguredMethods = getConfigured2FAMethods();

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
        // Get all available verification methods
        const { factors: userEnabledMethods } =
          await getUserVerificationMethods({
            supabase,
          });

        if (userEnabledMethods.length === 0) {
          toast.error("Error", {
            description: "No verification methods available",
          });
          return;
        }

        setDisableState({
          methodToDisable: method,
          userEnabledMethods,
          currentMethod: userEnabledMethods[0],
        });
        setShowDisableDialog(true);
      }
    } catch (error) {
      console.error("Error in method toggle:", error);
      toast.error("Error", {
        description: "Failed to update 2FA method. Please try again.",
      });
    } finally {
      setIsMethodLoading((prev) => ({ ...prev, [method]: false }));
    }
  };

  const handleVerificationMethodChange = (method: TVerificationFactor) => {
    if (!disableState) return;
    setDisableState({
      ...disableState,
      currentMethod: method,
    });
  };

  const handleDisableVerify = async (code: string) => {
    if (!disableState) return;

    try {
      setIsDisableVerifying(true);
      setDisableError(null);
      await onMethodDisable(disableState.methodToDisable, code);
      setShowDisableDialog(false);
      setDisableState(null);
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      setDisableError(
        error instanceof Error
          ? error.message
          : "Failed to disable 2FA. Please try again."
      );
    } finally {
      setIsDisableVerifying(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {availableConfiguredMethods
          .filter((method) => method.type !== "backup_codes")
          .map((method) => {
            const isEnabled = enabledMethods.includes(method.type);
            return (
              <MethodCard
                key={method.type}
                method={method}
                isEnabled={isEnabled}
                isLoading={isMethodLoading[method.type]}
                onToggle={handleMethodToggle}
              />
            );
          })}
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
          backupCodes={backupCodes}
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
              {disableState?.methodToDisable === "authenticator"
                ? "authenticator app"
                : "SMS"}{" "}
              authentication.
            </DialogDescription>
          </DialogHeader>
          {disableState && (
            <VerifyForm
              factorId={disableState.currentMethod.factorId}
              availableMethods={disableState.userEnabledMethods}
              onVerify={handleDisableVerify}
              onMethodChange={handleVerificationMethodChange}
              isVerifying={isDisableVerifying}
              error={disableError}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MethodCard({
  method,
  isEnabled,
  isLoading,
  onToggle,
}: {
  method: ReturnType<typeof getConfigured2FAMethods>[number];
  isEnabled: boolean;
  isLoading: boolean;
  onToggle: (method: TTwoFactorMethod, shouldEnable: boolean) => Promise<void>;
}) {
  const methodIcons: Partial<Record<TTwoFactorMethod, React.ReactNode>> = {
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
