"use client";

import { Button } from "@/components/ui/button";
import { FaGoogle, FaGithub } from "react-icons/fa";
import { AUTH_CONFIG } from "@/config/auth";
import { TSocialProvider } from "@/types/auth";

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
        <div className="flex items-center justify-between border p-4 px-6 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
              <FaGoogle className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold">Google</h3>
              <p className="text-sm text-muted-foreground">
                Sign in with your Google account
              </p>
            </div>
          </div>
          <Button
            variant={identities.includes("google") ? "destructive" : "outline"}
            size="sm"
            disabled={isLoading}
          >
            {isLoading
              ? "Loading..."
              : identities.includes("google")
                ? "Disconnect"
                : "Connect"}
          </Button>
        </div>
      )}

      {socialProviders.github.enabled && (
        <div className="flex items-center justify-between border p-4 px-6 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
              <FaGithub className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold">GitHub</h3>
              <p className="text-sm text-muted-foreground">
                Sign in with your GitHub account
              </p>
            </div>
          </div>
          <Button
            variant={identities.includes("github") ? "destructive" : "outline"}
            size="sm"
            disabled={isLoading}
          >
            {isLoading
              ? "Loading..."
              : identities.includes("github")
                ? "Disconnect"
                : "Connect"}
          </Button>
        </div>
      )}
    </div>
  );
}
