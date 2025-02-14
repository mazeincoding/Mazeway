"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user-store";
import { KeyRound, ShieldIcon } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import {
  passwordChangeSchema,
  type PasswordChangeSchema,
} from "@/utils/validation/auth-validation";
import { toast } from "sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { TTwoFactorMethod } from "@/types/auth";
import { TwoFactorMethods } from "@/components/2fa-methods";
import { DeviceSessionsList } from "@/components/device-sessions-list";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function Security() {
  const { isLoading, user, refreshUser, disable2FA } = useUserStore();
  const hasPasswordAuth = user?.has_password ?? false;
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{ type: TTwoFactorMethod; factorId: string }>;
    password: string;
  } | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");

  const form = useForm<PasswordChangeSchema>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const handlePasswordVisibilityChange = (field: string, show: boolean) => {
    setShowPasswords({
      currentPassword: show,
      newPassword: show,
    });
  };

  const onSubmit = async (values: PasswordChangeSchema) => {
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 4000,
          });
          return;
        }

        if (data.error?.includes("identity_not_found")) {
          toast.error("Cannot add password", {
            description:
              "There was an issue adding a password to your OAuth account. Please try again or contact support.",
            duration: 4000,
          });
          return;
        }

        throw new Error(data.error || "Failed to update password");
      }

      if (data.requiresTwoFactor) {
        setTwoFactorData({
          factorId: data.factorId,
          availableMethods: data.availableMethods,
          password: "",
        });
        return;
      }

      toast.success(hasPasswordAuth ? "Password updated" : "Password added", {
        description: hasPasswordAuth
          ? "Your password has been changed successfully."
          : "Password has been added to your account. You can now use it to log in.",
        duration: 3000,
      });

      form.reset();
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Failed to update password",
        duration: 3000,
      });
    }
  };

  const handleEnable2FA = async (method: TTwoFactorMethod, phone?: string) => {
    try {
      const response = await fetch("/api/auth/2fa/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method, phone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start 2FA enrollment");
      }

      const data = await response.json();

      // Store data based on method
      if (method === "authenticator") {
        setQrCode(data.qr_code);
        setSecret(data.secret);
      } else {
        // Clear authenticator-specific states if enrolling SMS
        setQrCode("");
        setSecret("");
      }
      // Store factor ID for both methods
      setFactorId(data.factor_id);
      setError(null);

      return data;
    } catch (err) {
      // Clean up all states on error
      setQrCode("");
      setSecret("");
      setFactorId("");
      setError(err instanceof Error ? err.message : "Failed to enable 2FA");
      console.error("Error enabling 2FA:", err);
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to enable 2FA",
      });
      throw err;
    }
  };

  const handleDisable2FA = async (method: TTwoFactorMethod, code: string) => {
    try {
      await disable2FA(method, code);

      // Success
      toast.success("2FA disabled", {
        description: `${method === "authenticator" ? "Authenticator app" : "SMS"} has been disabled.`,
        duration: 3000,
      });
    } catch (err) {
      console.error("Error disabling 2FA:", err);
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to disable 2FA",
      });
      throw err;
    }
  };

  const handleVerifyEnrollment = async (
    method: TTwoFactorMethod,
    code: string,
    phone?: string
  ) => {
    try {
      setIsVerifying(true);
      setError(null);

      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          factorId,
          code,
          method,
          phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 4000,
          });
          return;
        }

        setError(data.error || "Failed to verify code");
        return;
      }

      // Success
      toast.success("2FA enabled", {
        description: `${method === "authenticator" ? "Authenticator app" : "SMS"} has been enabled successfully.`,
        duration: 3000,
      });

      // Clear state
      setQrCode("");
      setSecret("");
      setFactorId("");
      setError(null);
      await refreshUser();
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingCard icon={KeyRound}>
        <SettingCard.Header>
          <SettingCard.Title>
            {hasPasswordAuth ? "Change password" : "Add password"}
          </SettingCard.Title>
          <SettingCard.Description>
            {hasPasswordAuth
              ? "Update your account password."
              : "Add a password to your account. You'll still be able to use your current login method."}
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content className="pb-4">
          <Form {...form}>
            <form
              id="password-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-2"
              noValidate
            >
              <div className="flex flex-col gap-6">
                {hasPasswordAuth && (
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            disabled={isLoading}
                            showPassword={showPasswords.currentPassword}
                            onShowPasswordChange={(show) =>
                              handlePasswordVisibilityChange(
                                "currentPassword",
                                show
                              )
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          disabled={isLoading}
                          showPassword={showPasswords.newPassword}
                          onShowPasswordChange={(show) =>
                            handlePasswordVisibilityChange("newPassword", show)
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </SettingCard.Content>
        <SettingCard.Footer>
          <Button type="submit" form="password-form" disabled={isLoading}>
            {hasPasswordAuth ? "Update password" : "Add password"}
          </Button>
        </SettingCard.Footer>
      </SettingCard>

      {AUTH_CONFIG.twoFactorAuth.enabled && (
        <SettingCard icon={ShieldIcon}>
          <SettingCard.Header>
            <SettingCard.Title>Two-factor authentication</SettingCard.Title>
            <SettingCard.Description>
              Add an extra layer of security to your account.
            </SettingCard.Description>
          </SettingCard.Header>
          <SettingCard.Content>
            <TwoFactorMethods
              enabledMethods={user?.auth.twoFactorMethods || []}
              onMethodSetup={handleEnable2FA}
              onMethodDisable={handleDisable2FA}
              onVerify={handleVerifyEnrollment}
              qrCode={qrCode}
              secret={secret}
              isVerifying={isVerifying}
              verificationError={error}
            />
          </SettingCard.Content>
        </SettingCard>
      )}

      <SettingCard icon={ShieldIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Manage devices</SettingCard.Title>
          <SettingCard.Description>
            Manage the devices you're logged into.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <DeviceSessionsList />
        </SettingCard.Content>
      </SettingCard>
    </div>
  );
}
