import { TTwoFactorMethod, TVerificationFactor } from "@/types/auth";
import { getConfigured2FAMethods } from "@/utils/auth";
import { MessageCircleIcon, QrCodeIcon } from "lucide-react";
import { Switch } from "./ui/switch";
import { useState } from "react";
import { api } from "@/utils/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VerifyForm } from "./verify-form";
import { TwoFactorSetupDialog } from "./2fa-setup-dialog";
import { useUser } from "@/hooks/use-auth";
import { toast } from "sonner";

interface TwoFactorMethodsProps {
  userEnabledMethods: TTwoFactorMethod[];
}

export function TwoFactorMethods({
  userEnabledMethods,
}: TwoFactorMethodsProps) {
  const availableConfiguredMethods = getConfigured2FAMethods();
  const { user, refresh: refreshUser } = useUser();
  const [isMethodLoading, setIsMethodLoading] = useState<
    Record<string, boolean>
  >({});
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
    toggleAction: {
      method: TTwoFactorMethod;
      shouldEnable: boolean;
    };
  } | null>(null);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState<{
    qrCode: string;
    secret: string;
    phone?: string;
  } | null>(null);
  const [activeMethod, setActiveMethod] = useState<TTwoFactorMethod | null>(
    null
  );

  // Handle toggling a 2FA method (enable or disable)
  const handleMethodToggle = async ({
    method,
    shouldEnable,
  }: {
    method: TTwoFactorMethod;
    shouldEnable: boolean;
  }) => {
    try {
      setIsMethodLoading((prev) => ({ ...prev, [method]: true }));
      const loadingToast = toast.loading(
        `${shouldEnable ? "Enabling" : "Disabling"} ${method}...`
      );

      if (shouldEnable) {
        await enableMethod(method);
      } else {
        await disableMethod(method);
      }

      toast.dismiss(loadingToast);
    } catch (error) {
      console.error("Error toggling method:", error);
      toast.error("Error", {
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while updating 2FA settings",
        duration: 3000,
      });
    } finally {
      setIsMethodLoading((prev) => ({ ...prev, [method]: false }));
    }
  };

  // Handle enabling a 2FA method
  const enableMethod = async (
    method: TTwoFactorMethod,
    { skipVerificationCheck = false }: { skipVerificationCheck?: boolean } = {}
  ) => {
    try {
      // Step 1: Check if verification is needed before enabling (only if not skipping verification check)
      if (!skipVerificationCheck) {
        const data = await api.auth.setup2FA({
          method,
          checkVerificationOnly: true,
        });

        // If verification is needed, show verification dialog
        if (
          data.requiresVerification &&
          data.availableMethods &&
          data.availableMethods.length > 0
        ) {
          setVerificationData({
            availableMethods: data.availableMethods,
            toggleAction: { method, shouldEnable: true },
          });
          setNeedsVerification(true);
          return;
        }
      }

      // Step 2: Verification completed or not needed, proceed with setup
      const data = await api.auth.setup2FA({ method });

      if (!data.requiresVerification) {
        // Store setup data and show setup dialog
        setActiveMethod(method);
        setSetup2FAData({
          qrCode: data.qr_code || "",
          secret: data.secret || "",
          phone: data.phone,
        });
        setShowSetupDialog(true);
      }

      // Clear verification state
      setNeedsVerification(false);
      setVerificationData(null);
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Failed to set up 2FA",
        duration: 3000,
      });
      // Clear verification state on error
      setNeedsVerification(false);
      setVerificationData(null);
    }
  };

  // Handle disabling a 2FA method
  const disableMethod = async (
    method: TTwoFactorMethod,
    { skipVerificationCheck = false }: { skipVerificationCheck?: boolean } = {}
  ) => {
    try {
      // Step 1: Check if verification is needed before disabling
      if (!skipVerificationCheck) {
        const data = await api.auth.disable2FA({
          method,
          checkVerificationOnly: true,
        });

        // If verification is needed, show verification dialog
        if (
          data.requiresVerification &&
          data.availableMethods &&
          data.availableMethods.length > 0
        ) {
          setVerificationData({
            availableMethods: data.availableMethods,
            toggleAction: { method, shouldEnable: false },
          });
          setNeedsVerification(true);
          return;
        }
      }

      // Step 2: If no verification needed or verification skipped, proceed with disable
      await api.auth.disable2FA({ method });

      // Show success message
      toast.success("2FA disabled", {
        description: `${method === "authenticator" ? "Authenticator app" : "SMS"} has been disabled.`,
        duration: 3000,
      });

      // Clear verification state and refresh user data
      setNeedsVerification(false);
      setVerificationData(null);
      await refreshUser();
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Failed to disable 2FA",
        duration: 3000,
      });
      // Clear verification state on error
      setNeedsVerification(false);
      setVerificationData(null);
    }
  };

  // Handle verification completion
  const handleVerificationComplete = async () => {
    if (!verificationData) return;

    const { method, shouldEnable } = verificationData.toggleAction;

    if (shouldEnable) {
      await enableMethod(method, { skipVerificationCheck: true });
    } else {
      await disableMethod(method, { skipVerificationCheck: true });
    }
  };

  // Handle setup dialog close - refresh user data
  const handleSetupComplete = async () => {
    await refreshUser();
    setShowSetupDialog(false);
    setSetup2FAData(null);
    setActiveMethod(null);
  };

  return (
    <>
      <div className="space-y-6">
        {availableConfiguredMethods
          .filter((method) => method.type !== "backup_codes")
          .map((method) => {
            const isEnabled = userEnabledMethods.includes(method.type);

            return (
              <MethodCard
                key={method.type}
                method={method}
                isEnabled={isEnabled}
                isLoading={isMethodLoading[method.type]}
                onToggle={(method, shouldEnable) =>
                  handleMethodToggle({ method, shouldEnable })
                }
              />
            );
          })}
      </div>

      {/* Verification Dialog */}
      {verificationData && verificationData.availableMethods && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please confirm your identity to{" "}
                {verificationData.toggleAction.shouldEnable
                  ? "enable"
                  : "disable"}{" "}
                two-factor authentication
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={verificationData.availableMethods}
              onVerifyComplete={handleVerificationComplete}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Setup Dialog */}
      {showSetupDialog && activeMethod && setup2FAData && (
        <TwoFactorSetupDialog
          isOpen={showSetupDialog}
          onClose={handleSetupComplete}
          method={activeMethod}
          qrCode={setup2FAData.qrCode}
          secret={setup2FAData.secret}
          phone={setup2FAData.phone}
        />
      )}
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
    authenticator: <QrCodeIcon className="h-7 w-7" />,
    sms: <MessageCircleIcon className="h-7 w-7" />,
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
          {methodIcons[method.type]}
        </div>
        <div className="flex flex-col">
          <h3 className="font-semibold">{method.title}</h3>
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
