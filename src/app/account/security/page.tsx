"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, ShieldIcon, ScrollText, InfoIcon } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import {
  passwordChangeSchema,
  addPasswordSchema,
  type PasswordChangeSchema,
  type AddPasswordSchema,
} from "@/validation/auth-validation";
import { toast } from "sonner";
import {
  TTwoFactorMethod,
  TVerificationFactor,
  TSocialProvider,
} from "@/types/auth";
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
import { SocialProviders } from "@/components/social-providers";

export default function Security() {
  const { user, isLoading, refresh: refreshUser } = useUser();
  const [isVerifying, setIsVerifying] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);

  const hasPasswordAuth = user?.has_password ?? false;
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationMethods, setVerificationMethods] = useState<
    TVerificationFactor[]
  >([]);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const form = useForm<PasswordChangeSchema | AddPasswordSchema>({
    resolver: zodResolver(
      hasPasswordAuth ? passwordChangeSchema : addPasswordSchema
    ),
    defaultValues: hasPasswordAuth
      ? {
          currentPassword: "",
          newPassword: "",
        }
      : {
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
    values: PasswordChangeSchema | AddPasswordSchema,
    verificationCode?: string
  ) => {
    console.log("updatePassword called with:", { values, verificationCode });
    setError(null);
    setIsChangingPassword(true);

    try {
      // If we're in verification mode, verify first
      if (verificationCode && verificationMethods) {
        console.log("Verifying 2FA code...");
        setIsVerifying(true);
        await api.auth.verify({
          factorId: verificationMethods[0].factorId,
          code: verificationCode,
          method: verificationMethods[0].type,
        });
      }

      // After verification (or if no verification needed), change password
      const params: TChangePasswordRequest = {
        currentPassword: hasPasswordAuth
          ? (values as PasswordChangeSchema).currentPassword
          : undefined,
        newPassword: values.newPassword,
      };
      console.log("Sending password change request with params:", params);

      const data = await api.auth.changePassword(params);
      console.log("Password change response:", data);

      // Check if verification is required
      if (data.requiresVerification && data.availableMethods) {
        setVerificationMethods(data.availableMethods);
        setShowTwoFactorDialog(true);
        return;
      }

      // Check if re-login is required (for OAuth users adding password)
      if (data.requiresRelogin) {
        // Show success message and redirect to login
        toast.success("Password added", {
          description:
            data.message ||
            "Password has been added to your account. Please log in again.",
          duration: 5000,
        });

        // Reset form and dialog state
        setShowTwoFactorDialog(false);
        form.reset();

        // Redirect to login with the email pre-filled
        window.location.href = `/auth/login?email=${encodeURIComponent(data.email || "")}&message=${encodeURIComponent(data.message || "")}`;
        return;
      }

      // Regular success case
      toast.success(hasPasswordAuth ? "Password updated" : "Password added", {
        description: hasPasswordAuth
          ? "Your password has been changed successfully."
          : "Password has been added to your account. You can now use it to log in.",
        duration: 3000,
      });

      // Reset form and dialog state
      setShowTwoFactorDialog(false);
      form.reset();

      await refreshUser();
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
      setIsChangingPassword(false);
    }
  };

  // Form submission handler
  const onSubmit = async (values: PasswordChangeSchema | AddPasswordSchema) => {
    console.log("Form submitted with values:", values);
    try {
      await updatePassword(values);
    } catch (error) {
      console.error("Error in form submission:", error);
    }
  };

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
              onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.log("Form validation errors:", errors);
              })}
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
                            disabled={isLoading || isChangingPassword}
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
                          disabled={isLoading || isChangingPassword}
                          showPassword={showPasswords.newPassword}
                          onShowPasswordChange={(show) =>
                            handlePasswordVisibilityChange("newPassword", show)
                          }
                          {...field}
                        />
                      </FormControl>
                      {!user?.has_password && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2 pt-2">
                          <InfoIcon className="w-4 h-4" />
                          You will need to log in again after adding a password.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </SettingCard.Content>
        <SettingCard.Footer>
          <Button
            type="submit"
            form="password-form"
            disabled={isLoading || isChangingPassword}
          >
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

      <SettingCard icon={ShieldIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Connections</SettingCard.Title>
          <SettingCard.Description>
            Manage your connected social accounts.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <SocialProviders
            identities={
              user?.auth?.identities?.map(
                (i) => i.provider as TSocialProvider
              ) ?? []
            }
            isLoading={isLoading}
          />
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
      {verificationMethods.length > 0 && (
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
