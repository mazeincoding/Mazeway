import { TTwoFactorMethod, TVerificationFactor } from "@/types/auth";
import {
  getConfigured2FAMethods,
  getUserVerificationMethods,
} from "@/utils/auth";
import { MessageCircleIcon, QrCodeIcon, TrashIcon } from "lucide-react";
import { Switch } from "./ui/switch";
import { useEffect, useState } from "react";
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
import { Button } from "./ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createClient } from "@/utils/supabase/client";

interface TwoFactorMethodsProps {
  userEnabledMethods: TTwoFactorMethod[];
}

export function TwoFactorMethods({
  userEnabledMethods,
}: TwoFactorMethodsProps) {
  const availableConfiguredMethods = getConfigured2FAMethods();
  const { refresh: refreshUser } = useUser();
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
  const [methodsToRefresh, setMethodsToRefresh] = useState<
    Set<TTwoFactorMethod>
  >(new Set());

  // Function to mark a method as needing refresh
  const markMethodForRefresh = (method: TTwoFactorMethod) => {
    setMethodsToRefresh((prev) => new Set(prev).add(method));
  };

  // Function to clear refresh flag for a method
  const clearMethodRefresh = (method: TTwoFactorMethod) => {
    setMethodsToRefresh((prev) => {
      const newSet = new Set(prev);
      newSet.delete(method);
      return newSet;
    });
  };

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
  const disableMethod = async (method: TTwoFactorMethod) => {
    try {
      // Attempt to disable the method
      const data = await api.auth.disable2FA({ method });

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
      await disableMethod(method);
    }
  };

  // Handle setup dialog close - refresh user data and trigger factor refresh
  const handleSetupComplete = async () => {
    if (activeMethod) {
      markMethodForRefresh(activeMethod);
    }
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
            const needsRefresh = methodsToRefresh.has(method.type);

            return (
              <MethodCard
                key={method.type}
                method={method}
                isEnabled={isEnabled}
                isLoading={isMethodLoading[method.type]}
                onToggle={(method, shouldEnable) =>
                  handleMethodToggle({ method, shouldEnable })
                }
                setActiveMethod={setActiveMethod}
                setSetup2FAData={setSetup2FAData}
                setShowSetupDialog={setShowSetupDialog}
                needsRefresh={needsRefresh}
                onRefreshComplete={() => clearMethodRefresh(method.type)}
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
  setActiveMethod,
  setSetup2FAData,
  setShowSetupDialog,
  needsRefresh,
  onRefreshComplete,
}: {
  method: ReturnType<typeof getConfigured2FAMethods>[number];
  isEnabled: boolean;
  isLoading: boolean;
  onToggle: (method: TTwoFactorMethod, shouldEnable: boolean) => Promise<void>;
  setActiveMethod: (method: TTwoFactorMethod | null) => void;
  setSetup2FAData: (
    data: { qrCode: string; secret: string; phone?: string } | null
  ) => void;
  setShowSetupDialog: (show: boolean) => void;
  needsRefresh: boolean;
  onRefreshComplete: () => void;
}) {
  const [methodFactors, setMethodFactors] = useState<TVerificationFactor[]>([]);
  const [isRemovingFactor, setIsRemovingFactor] = useState<string | null>(null);
  const [isAddingBackup, setIsAddingBackup] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
    pendingAction: {
      type: "remove" | "add";
      factorId?: string;
    };
  } | null>(null);
  const { refresh: refreshUser } = useUser();

  const methodIcons: Partial<Record<TTwoFactorMethod, React.ReactNode>> = {
    authenticator: <QrCodeIcon className="h-7 w-7" />,
    sms: <MessageCircleIcon className="h-7 w-7" />,
  };

  useEffect(() => {
    getFactors();
  }, [method.type, isEnabled]);

  // Add new effect to handle refresh requests
  useEffect(() => {
    if (needsRefresh) {
      getFactors().then(() => {
        onRefreshComplete();
      });
    }
  }, [needsRefresh, onRefreshComplete]);

  async function getFactors() {
    const supabase = createClient();
    const { factors } = await getUserVerificationMethods({
      supabase,
    });
    const filteredFactors = factors.filter(
      (factor) => factor.type === method.type
    );
    setMethodFactors(filteredFactors);
  }

  // Handle removing a specific factor
  const handleRemoveFactor = async (factorId: string) => {
    try {
      setIsRemovingFactor(factorId);

      const data = await api.auth.disable2FA({
        method: method.type,
        factorId,
      });

      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({
          availableMethods: data.availableMethods,
          pendingAction: { type: "remove", factorId },
        });
        setNeedsVerification(true);
        setIsRemovingFactor(null);
        return;
      }

      const loadingToast = toast.loading("Removing factor...");
      await api.auth.disable2FA({
        method: method.type,
        factorId,
      });

      toast.dismiss(loadingToast);
      toast.success("Factor removed", {
        description: "The authentication factor has been removed successfully.",
      });

      await getFactors();
      await refreshUser();
      setNeedsVerification(false);
      setVerificationData(null);
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Failed to remove factor",
      });
      // Clear verification state on error
      setNeedsVerification(false);
      setVerificationData(null);
    } finally {
      // Only clear loading state here, NOT verification state
      setIsRemovingFactor(null);
    }
  };

  // Handle adding a backup method
  const handleAddBackup = async ({
    skipVerificationCheck = false,
  }: {
    skipVerificationCheck?: boolean;
  } = {}) => {
    try {
      setIsAddingBackup(true);

      if (!skipVerificationCheck) {
        const data = await api.auth.setup2FA({
          method: method.type,
          checkVerificationOnly: true,
        });

        if (
          data.requiresVerification &&
          data.availableMethods &&
          data.availableMethods.length > 0
        ) {
          setVerificationData({
            availableMethods: data.availableMethods,
            pendingAction: { type: "add" },
          });
          setNeedsVerification(true);
          setIsAddingBackup(false);
          return;
        }
      }

      const loadingToast = toast.loading("Setting up backup method...");
      const data = await api.auth.setup2FA({
        method: method.type,
      });

      toast.dismiss(loadingToast);

      if (!data.requiresVerification) {
        setActiveMethod(method.type);
        setSetup2FAData({
          qrCode: data.qr_code || "",
          secret: data.secret || "",
          phone: data.phone,
        });
        setShowSetupDialog(true);
      }

      await getFactors();
      await refreshUser();

      // Only clear verification state if we actually completed the action
      setNeedsVerification(false);
      setVerificationData(null);
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to add backup method",
      });
      // Clear verification state on error
      setNeedsVerification(false);
      setVerificationData(null);
    } finally {
      // Only clear loading state here, NOT verification state
      setIsAddingBackup(false);
    }
  };

  // Handle verification completion
  const handleVerificationComplete = async () => {
    if (!verificationData) return;

    const { type, factorId } = verificationData.pendingAction;

    if (type === "remove" && factorId) {
      await handleRemoveFactor(factorId);
    } else if (type === "add") {
      await handleAddBackup({ skipVerificationCheck: true });
    }
  };

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1" className="border-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
              {methodIcons[method.type]}
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold">{method.title}</h3>
              <p className="text-sm text-muted-foreground">
                {method.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => onToggle(method.type, checked)}
              disabled={isLoading}
            />
            {isEnabled && (
              <AccordionTrigger className="h-9 w-9 p-0 hover:no-underline hover:bg-accent flex items-center justify-center rounded-full" />
            )}
          </div>
        </div>
        {isEnabled && (
          <AccordionContent className="pb-0">
            <div className="pl-11 space-y-4 pt-4">
              {methodFactors.map((factor) => (
                <div
                  key={factor.factorId}
                  className="flex items-center justify-between py-2 px-4 rounded-lg border bg-accent"
                >
                  <span className="text-sm font-medium">
                    {factor.friendly_name ||
                      `${method.title} ${factor.factorId.slice(0, 4)}`}
                  </span>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveFactor(factor.factorId)}
                      disabled={isRemovingFactor === factor.factorId}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                className="justify-start text-sm"
                onClick={() => handleAddBackup({})}
                disabled={isAddingBackup}
              >
                Add a backup{" "}
                {method.type === "authenticator"
                  ? "authenticator"
                  : "phone number"}
              </Button>
            </div>
          </AccordionContent>
        )}
      </AccordionItem>

      {/* Verification Dialog */}
      {verificationData && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please confirm your identity to{" "}
                {verificationData.pendingAction.type === "remove"
                  ? "remove this factor"
                  : "add a backup method"}
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={verificationData.availableMethods}
              onVerifyComplete={handleVerificationComplete}
            />
          </DialogContent>
        </Dialog>
      )}
    </Accordion>
  );
}
