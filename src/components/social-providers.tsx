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
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const { refresh } = useUser();

  useEffect(() => {
    setIsLoading(parentLoading ?? false);
  }, [parentLoading]);

  const handleSocialProviderAction = async ({
    skipVerificationCheck = false,
  }: {
    skipVerificationCheck?: boolean;
  } = {}) => {
    try {
      setIsLoading(true);

      if (isConnected) {
        await handleDisconnect({ skipVerificationCheck });
      } else {
        await handleConnect({ skipVerificationCheck });
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async ({
    skipVerificationCheck = false,
  }: {
    skipVerificationCheck?: boolean;
  } = {}) => {
    if (!skipVerificationCheck) {
      const data = await api.auth.connectSocialProvider({
        provider,
        checkVerificationOnly: true,
      });

      console.log("Connect social provider", { data });

      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({
          availableMethods: data.availableMethods,
        });
        setNeedsVerification(true);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }
    }

    const data = await api.auth.connectSocialProvider({
      provider,
    });
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const handleDisconnect = async ({
    skipVerificationCheck = false,
  }: {
    skipVerificationCheck?: boolean;
  } = {}) => {
    if (!skipVerificationCheck) {
      console.log("Checking verification only");
      const data = await api.auth.disconnectSocialProvider({
        provider,
        checkVerificationOnly: true,
      });

      console.log("Verification check complete", { data });

      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({
          availableMethods: data.availableMethods,
        });
        setNeedsVerification(true);
        return;
      }
    }

    console.log("Disconnecting social provider");

    const result = await api.auth.disconnectSocialProvider({
      provider,
    });

    const providerTitle = provider.charAt(0).toUpperCase() + provider.slice(1);

    console.log("Disconnection complete", { result });

    toast.success(`${providerTitle} account disconnected`);

    await refresh();
  };

  const handleVerifyComplete = () => {
    handleSocialProviderAction({ skipVerificationCheck: true });
    setVerificationData(null);
    setNeedsVerification(false);
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
          onClick={() => handleSocialProviderAction()}
        >
          {isLoading ? "Loading..." : isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>

      {needsVerification && verificationData && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent className="space-y-4">
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please verify your identity to{" "}
                {isConnected ? "disconnect" : "connect"} your {title} account.
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={verificationData.availableMethods}
              onVerifyComplete={handleVerifyComplete}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
