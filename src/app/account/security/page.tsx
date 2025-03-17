"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, ShieldIcon, ScrollText } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import {
  passwordChangeSchema,
  type PasswordChangeSchema,
} from "@/validation/auth-validation";
import { toast } from "sonner";
import { TTwoFactorMethod, TVerificationFactor } from "@/types/auth";
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
import { useUser } from "@/hooks/use-auth";
import { api } from "@/utils/api";
import { TChangePasswordRequest } from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VerifyForm } from "@/components/verify-form";
import { EventLog } from "@/components/event-log";

export default function Security() {
  const { user, isLoading, refresh: refreshUser } = useUser();
  const [isVerifying, setIsVerifying] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);

  const hasPasswordAuth = user?.has_password ?? false;
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [verificationFactorId, setVerificationFactorId] = useState<
    string | null
  >(null);
  const [verificationMethods, setVerificationMethods] = useState<
    TVerificationFactor[] | null
  >(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

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

  const updatePassword = async (
    values: PasswordChangeSchema,
    verificationCode?: string
  ) => {
    setError(null);

    try {
      // If we're in verification mode, verify first
      if (verificationCode && verificationFactorId && verificationMethods) {
        setIsVerifying(true);
        await api.auth.verify({
          factorId: verificationFactorId,
          code: verificationCode,
          method: verificationMethods[0].type,
        });
      }

      // After verification (or if no verification needed), change password
      const params: TChangePasswordRequest = {
        currentPassword: form.getValues("currentPassword"),
        newPassword: form.getValues("newPassword"),
      };

      const data = await api.auth.changePassword(params);

      // Check if 2FA is required
      if (data.requiresTwoFactor && data.factorId && data.availableMethods) {
        setVerificationFactorId(data.factorId);
        setVerificationMethods(data.availableMethods);
        setShowTwoFactorDialog(true);
        return;
      }

      // Success - password was changed
      toast.success(hasPasswordAuth ? "Password updated" : "Password added", {
        description: hasPasswordAuth
          ? "Your password has been changed successfully."
          : "Password has been added to your account. You can now use it to log in.",
        duration: 3000,
      });

      // Reset form and dialog state
      setShowTwoFactorDialog(false);
      form.reset();

      // Refresh user data if needed
      if (verificationCode) {
        await refreshUser();
      }
    } catch (error) {
      if (error instanceof Error) {
        // Handle rate limiting error
        if (error.message.includes("Too many requests")) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 3000,
          });
          return;
        }

        // Handle OAuth identity error
        if (error.message.includes("identity_not_found")) {
          toast.error("Cannot add password", {
            description:
              "There was an issue adding a password to your OAuth account. Please try again or contact support.",
            duration: 3000,
          });
          return;
        }

        setError(error.message);
        toast.error("Error", {
          description: error.message || "Failed to update password",
          duration: 3000,
        });
      } else {
        setError("An unexpected error occurred");
        toast.error("Error", {
          description: "Failed to update password",
          duration: 3000,
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Form submission handler
  const onSubmit = (values: PasswordChangeSchema) => updatePassword(values);

  // 2FA verification handler
  const handleVerifyPasswordChange = (code: string) =>
    updatePassword({} as PasswordChangeSchema, code);

  const handleEnable2FA = async (method: TTwoFactorMethod, phone?: string) => {
    try {
      const result = await api.auth.setup2FA({ method, phone });

      // Store data based on method
      if (method === "authenticator") {
        setQrCode(result.qr_code || "");
        setSecret(result.secret || "");
      } else {
        // Clear authenticator-specific states if enrolling SMS
        setQrCode("");
        setSecret("");
      }
      // Store factor ID for both methods
      setFactorId(result.factor_id || "");

      setError(null);
    } catch (err) {
      // Clean up all states on error
      setQrCode("");
      setSecret("");
      setFactorId("");
      setBackupCodes([]);
      setError("An unexpected error occurred");
      console.error("Unexpected error in 2FA setup:", err);
      toast.error("Error", {
        description: "An unexpected error occurred",
        duration: 3000,
      });
    }
  };

  const handleDisable2FA = async (method: TTwoFactorMethod, code: string) => {
    try {
      await api.auth.disable2FA({ method, code });

      // Success
      toast.success("2FA disabled", {
        description: `${method === "authenticator" ? "Authenticator app" : "SMS"} has been disabled.`,
        duration: 3000,
      });

      await refreshUser();
    } catch (err) {
      // Throw the error to be handled by the component
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
      console.log("Starting verification with:", { method, factorId });

      // First try-catch block just for the verification API call
      const response = await api.auth.verify({ factorId, method, code, phone });
      console.log("Verification response:", response);

      // If we got backup codes from verification, set them
      if (response.backup_codes) {
        console.log("Setting backup codes:", response.backup_codes);
        setBackupCodes(response.backup_codes);
      }

      // Separate try-catch for post-verification operations
      try {
        if (response.backup_codes) {
          // Only show success message after user has seen backup codes
          // The TwoFactorMethods component should handle showing these and clearing state
          setError(null);
          await refreshUser();
        } else {
          console.log("No backup codes in response");
          // If no backup codes (not first 2FA method), clear state immediately
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
        }
      } catch (postVerifyError) {
        // If there's an error after verification (like during refreshUser),
        // we don't want to clear backup codes if we received them
        setError(
          "2FA was enabled but there was an error refreshing the page. Please reload."
        );
      }
    } catch (err) {
      console.error("Unexpected error in 2FA verification:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to verify code. Please try again."
      );
      // Only clear backup codes if we haven't received them yet
      if (!backupCodes.length) {
        setBackupCodes([]);
      }
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

      <SettingCard icon={ShieldIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Two-factor authentication</SettingCard.Title>
          <SettingCard.Description>
            Add an extra layer of security to your account.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <TwoFactorMethods
            enabledMethods={user?.auth?.enabled2faMethods ?? []}
            onMethodSetup={handleEnable2FA}
            onMethodDisable={handleDisable2FA}
            onVerify={handleVerifyEnrollment}
            qrCode={qrCode}
            secret={secret}
            backupCodes={backupCodes}
            isVerifying={isVerifying}
            verificationError={error}
          />
        </SettingCard.Content>
      </SettingCard>

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

      <SettingCard icon={ScrollText} className="!p-0">
        <SettingCard.Header>
          <SettingCard.Title>Recent activity</SettingCard.Title>
          <SettingCard.Description>
            Review recent security events and changes to your account.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <EventLog />
        </SettingCard.Content>
      </SettingCard>

      {/* 2FA Dialog for Password Change */}
      {verificationFactorId && verificationMethods && (
        <Dialog
          open={showTwoFactorDialog}
          onOpenChange={setShowTwoFactorDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please enter your two-factor authentication code to change your
                password.
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              factorId={verificationFactorId}
              availableMethods={verificationMethods}
              onVerify={handleVerifyPasswordChange}
              isVerifying={isVerifying}
              error={error}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
