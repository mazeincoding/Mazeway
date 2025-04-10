"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoIcon } from "lucide-react";
import {
  passwordChangeSchema,
  addPasswordSchema,
  type PasswordChangeSchema,
  type AddPasswordSchema,
} from "@/validation/auth-validation";
import { toast } from "sonner";
import { TVerificationFactor, TSocialProvider } from "@/types/auth";
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
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

export default function Security() {
  const { user, isLoading, refresh: refreshUser } = useUser();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);

  const hasPasswordAuth = user?.has_password ?? false;
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
  });

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
      ...showPasswords,
      [field]: show,
    });
  };

  const updatePassword = async () => {
    try {
      setIsChangingPassword(true);

      // Get form values
      const values = form.getValues();

      // Prepare the password change request
      const params: TChangePasswordRequest = {
        currentPassword: hasPasswordAuth
          ? (values as PasswordChangeSchema).currentPassword
          : undefined,
        newPassword: values.newPassword,
        checkVerificationOnly: true,
      };

      const data = await api.auth.changePassword(params);

      // Check if verification is required
      if (
        data.requiresTwoFactor &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setTwoFactorData({ availableMethods: data.availableMethods });
        setNeedsVerification(true);
        return;
      }

      // Verification not needed, proceed with the actual password change
      handleFinalPasswordChange();
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Error", {
          description: error.message || "Failed to update password",
          duration: 3000,
        });
      } else {
        toast.error("Error", {
          description: "Failed to update password",
          duration: 3000,
        });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleFinalPasswordChange = async () => {
    try {
      setIsChangingPassword(true);

      // Get form values
      const values = form.getValues();

      // Prepare the password change request without checkVerificationOnly
      const params: TChangePasswordRequest = {
        currentPassword: hasPasswordAuth
          ? (values as PasswordChangeSchema).currentPassword
          : undefined,
        newPassword: values.newPassword,
      };

      const data = await api.auth.changePassword(params);

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
        setNeedsVerification(false);
        setTwoFactorData(null);
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

      // Reset verification state and form
      setNeedsVerification(false);
      setTwoFactorData(null);
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

        toast.error("Error", {
          description: error.message || "Failed to update password",
          duration: 3000,
        });
      } else {
        toast.error("Error", {
          description: "Failed to update password",
          duration: 3000,
        });
      }
    } finally {
      setIsChangingPassword(false);
      setNeedsVerification(false);
    }
  };

  // Form submission handler
  const onSubmit = async () => {
    await updatePassword();
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-2">
      <h1 className="text-3xl font-bold">Security</h1>

      {/* Password section */}
      <section className="flex justify-between items-center">
        <div className="flex flex-col gap-1.5 flex-1">
          <Form {...form}>
            <form
              id="password-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
              noValidate
            >
              {hasPasswordAuth && (
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        Current password
                      </FormLabel>
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
                          autoComplete="current-password"
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
                    <FormLabel className="text-base">New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={isLoading || isChangingPassword}
                        showPassword={showPasswords.newPassword}
                        onShowPasswordChange={(show) =>
                          handlePasswordVisibilityChange("newPassword", show)
                        }
                        autoComplete="new-password"
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
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading || isChangingPassword}
                >
                  {hasPasswordAuth ? "Change password" : "Add password"}
                </Button>
                <Button
                  type="button"
                  disabled={isLoading || isChangingPassword}
                  variant="outline"
                >
                  <Link href="/auth/forgot-password">Forgot password?</Link>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </section>

      <Separator className="my-2" />

      {/* Two-factor authentication section */}
      <section className="flex flex-col flex-1">
        <h2 className="font-bold text-xl">Two-factor authentication</h2>
        <div className="mt-4">
          <TwoFactorMethods
            userEnabledMethods={user?.auth?.enabled2faMethods ?? []}
          />
        </div>
      </section>

      <Separator className="my-2" />

      {/* Device management section */}
      <section className="flex flex-col flex-1">
        <h2 className="font-bold text-xl">Device management</h2>
        <div className="mt-4">
          <DeviceSessionsList />
        </div>
      </section>

      <Separator className="my-2" />

      {/* Connections section */}
      <section className="flex flex-col flex-1">
        <h2 className="font-bold text-xl">Connections</h2>
        <p className="text-muted-foreground mt-1">
          Manage your connected social accounts.
        </p>
        <div className="mt-4">
          <SocialProviders
            identities={
              user?.auth?.identities?.map(
                (i) => i.provider as TSocialProvider
              ) ?? []
            }
            isLoading={isLoading}
          />
        </div>
      </section>

      <Separator className="my-2" />

      {/* Recent activity section */}
      <section className="flex flex-col flex-1">
        <h2 className="font-bold text-xl">Recent activity</h2>
        <p className="text-muted-foreground mt-1">
          Review recent security events and changes to your account.
        </p>
        <div className="mt-4">
          <EventLog />
        </div>
      </section>

      {/* 2FA Dialog for Password Change */}
      {twoFactorData && twoFactorData.availableMethods && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please enter your two-factor authentication code to change your
                password.
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={twoFactorData.availableMethods}
              onVerifyComplete={handleFinalPasswordChange}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
