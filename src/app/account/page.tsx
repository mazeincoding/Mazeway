"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-auth";
import { UserIcon } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import {
  profileSchema,
  type ProfileSchema,
} from "@/utils/validation/auth-validation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VerifyForm } from "@/components/verify-form";
import { TVerificationFactor } from "@/types/auth";
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
import DeleteAccount from "@/components/delete-account";
import { api } from "@/utils/api";

export default function Account() {
  const { user, isLoading: isUserLoading } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: TVerificationFactor[];
    newEmail: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  useEffect(() => {
    if (user) {
      const currentValues = form.getValues();
      if (
        currentValues.name !== user.name ||
        currentValues.email !== user.email
      ) {
        form.reset({
          name: user.name || "",
          email: user.email || "",
        });
      }
    }
  }, [user]);

  const handleVerify2FA = async (code: string) => {
    if (!twoFactorData) return;

    try {
      setIsVerifying(true);
      setError(null);

      // First verify using the centralized verify endpoint
      await api.auth.verify({
        factorId: twoFactorData.factorId,
        code,
        method: twoFactorData.availableMethods[0].type,
      });

      // After successful verification, change email
      await api.auth.changeEmail({
        newEmail: twoFactorData.newEmail,
      });

      // Success - email verification will be sent
      toast.success("Verification email sent", {
        description: "Please check your new email address for verification.",
        duration: 5000,
      });

      setTwoFactorData(null);
      setShowTwoFactorDialog(false);
      form.setValue("email", user?.email || "");
    } catch (err) {
      if (err instanceof Error && err.message.includes("Too many requests")) {
        toast.error("Too many attempts", {
          description: "Please wait a moment before trying again.",
          duration: 3000,
        });
        return;
      }
      console.error("Error verifying 2FA:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (values: ProfileSchema) => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const changedData: Partial<ProfileSchema> = {};
      if (values.name !== user.name) changedData.name = values.name;

      if (values.email !== user.email) {
        try {
          const data = await api.auth.changeEmail({ newEmail: values.email });

          if (
            data.requiresTwoFactor &&
            data.factorId &&
            data.availableMethods
          ) {
            setTwoFactorData({
              factorId: data.factorId,
              availableMethods: data.availableMethods,
              newEmail: values.email,
            });
            setShowTwoFactorDialog(true);
            return;
          }

          toast.success("Verification email sent", {
            description:
              "Please check your new email address for verification.",
            duration: 5000,
          });

          // Reset form email field
          form.setValue("email", user.email);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("Too many requests")
          ) {
            toast.error("Too many attempts", {
              description: "Please wait a moment before trying again.",
              duration: 3000,
            });
            return;
          }
          toast.error("Error", {
            description:
              error instanceof Error ? error.message : "Failed to update email",
            duration: 3000,
          });
          return;
        }
      }

      // Handle other profile updates
      if (Object.keys(changedData).length > 0) {
        try {
          await api.user.update(changedData);

          toast.success("Profile updated", {
            description: "Your profile has been updated successfully.",
            duration: 3000,
          });
        } catch (error) {
          toast.error("Error", {
            description:
              error instanceof Error ? error.message : "An error occurred",
            duration: 3000,
          });
        }
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingCard icon={UserIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Basic information</SettingCard.Title>
          <SettingCard.Description>
            Manage your basic information.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <Form {...form}>
            <form
              id="account-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        disabled={isUpdating || isUserLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        disabled={isUpdating || isUserLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </SettingCard.Content>
        <SettingCard.Footer>
          <Button
            type="submit"
            form="account-form"
            disabled={isUpdating || isUserLoading}
          >
            Save
          </Button>
        </SettingCard.Footer>
      </SettingCard>

      <SettingCard icon={UserIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Delete account</SettingCard.Title>
          <SettingCard.Description>
            Permanently delete your account and all associated data.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <h4 className="mb-2 font-medium text-destructive">
                Important Information
              </h4>
              <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                <li>
                  All your personal information and settings will be permanently
                  erased
                </li>
                <li>Your account cannot be recovered once deleted</li>
                <li>All your data will be removed from our servers</li>
              </ul>
            </div>
            <DeleteAccount>
              <Button variant="destructive" className="w-full sm:w-auto">
                I understand, delete my account
              </Button>
            </DeleteAccount>
          </div>
        </SettingCard.Content>
      </SettingCard>

      {showTwoFactorDialog && twoFactorData && (
        <Dialog
          open={showTwoFactorDialog}
          onOpenChange={setShowTwoFactorDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please enter your two-factor authentication code to change your
                email address.
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              factorId={twoFactorData.factorId}
              availableMethods={twoFactorData.availableMethods}
              onVerify={handleVerify2FA}
              isVerifying={isVerifying}
              error={error}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
