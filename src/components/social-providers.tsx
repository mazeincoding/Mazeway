"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FaGoogle, FaGithub } from "react-icons/fa";
import { AUTH_CONFIG } from "@/config/auth";
import { api } from "@/utils/api";
import { toast } from "sonner";
import { TSocialProvider, TVerificationFactor } from "@/types/auth";
import { useUser } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VerifyForm } from "./verify-form";

interface SocialProvidersProps {
  identities: TSocialProvider[];
  isLoading?: boolean;
}

export function SocialProviders({
  identities,
  isLoading,
}: SocialProvidersProps) {
  const { socialProviders } = AUTH_CONFIG;

  return (
    <div className="space-y-6">
      {socialProviders.google.enabled && (
        <SocialProvider
          provider="google"
          isConnected={identities.includes("google")}
          isLoading={isLoading}
        />
      )}

      {socialProviders.github.enabled && (
        <SocialProvider
          provider="github"
          isConnected={identities.includes("github")}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

interface SocialProviderProps {
  provider: TSocialProvider;
  isConnected: boolean;
  isLoading?: boolean;
}

function SocialProvider({
  provider,
  isConnected,
  isLoading: parentLoading,
}: SocialProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const { refresh } = useUser();

  useEffect(() => {
    setIsLoading(parentLoading ?? false);
  }, [parentLoading]);

  const handleVerify = async (code: string, factorId: string) => {
    console.log("handleVerify", code, factorId);
    try {
      setIsVerifying(true);
      setVerifyError(null);

      if (isConnected) {
        await api.auth.verify({
          factorId,
          code,
          method: twoFactorData!.availableMethods[0].type,
        });
        await api.auth.disconnectSocialProvider(provider);
        toast.success(`${provider} account disconnected`);
      } else {
        await api.auth.verify({
          factorId,
          code,
          method: twoFactorData!.availableMethods[0].type,
        });
        const result = await api.auth.connectSocialProvider(provider);
        if ("url" in result) {
          window.location.href = result.url;
        }
      }

      setShowTwoFactorDialog(false);
      setTwoFactorData(null);
      await refresh();
    } catch (error) {
      console.error("Error in verification:", error);
      setVerifyError(
        error instanceof Error ? error.message : "Verification failed"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClick = async () => {
    console.log("[handleClick] isConnected", isConnected);
    try {
      setIsLoading(true);

      if (isConnected) {
        const result = await api.auth.disconnectSocialProvider(provider);
        console.log("[handleClick] disconnect result:", result);
        if ("requiresVerification" in result) {
          console.log("[handleClick] setting two factor data:", {
            availableMethods: result.availableMethods,
          });
          setTwoFactorData({
            availableMethods: result.availableMethods!,
          });
          setShowTwoFactorDialog(true);
          return;
        }
        toast.success(`${provider} account disconnected`);
        await refresh();
      } else {
        const result = await api.auth.connectSocialProvider(provider);
        console.log("[handleClick] connect result:", result);
        if ("requiresVerification" in result) {
          console.log("[handleClick] setting two factor data:", {
            availableMethods: result.availableMethods,
          });
          setTwoFactorData({
            availableMethods: result.availableMethods!,
          });
          setShowTwoFactorDialog(true);
          return;
        }
        if ("url" in result) {
          window.location.href = result.url;
        }
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = provider === "google" ? FaGoogle : FaGithub;
  const title = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <>
      <div className="flex items-center justify-between border p-4 px-6 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 flex items-center justify-center">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">
              Sign in with your {title} account
            </p>
          </div>
        </div>
        <Button
          variant={isConnected ? "destructive" : "outline"}
          size="sm"
          disabled={isLoading}
          onClick={handleClick}
        >
          {isLoading ? "Loading..." : isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>

      {showTwoFactorDialog && twoFactorData && (
        <Dialog
          open={showTwoFactorDialog}
          onOpenChange={setShowTwoFactorDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please verify your identity to{" "}
                {isConnected ? "disconnect" : "connect"} your {title} account.
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={twoFactorData.availableMethods}
              onVerify={handleVerify}
              isVerifying={isVerifying}
              error={verifyError}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
