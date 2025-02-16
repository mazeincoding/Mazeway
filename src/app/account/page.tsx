"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user-store";
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
import { TwoFactorVerifyForm } from "@/components/2fa-verify-form";
import { TTwoFactorMethod } from "@/types/auth";
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

export default function Account() {
  const { user, updateUser } = useUserStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{ type: TTwoFactorMethod; factorId: string }>;
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

  // Update form when user data is available
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

      // Send 2FA verification to complete email change
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorId: twoFactorData.factorId,
          code,
          newEmail: twoFactorData.newEmail,
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

      // Success - email verification will be sent
      toast.success("Verification email sent", {
        description: "Please check your new email address for verification.",
        duration: 5000,
      });

      // Clear state
      setTwoFactorData(null);
      setShowTwoFactorDialog(false);

      // Reset form to current email since change isn't complete yet
      form.setValue("email", user?.email || "");
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (values: ProfileSchema) => {
    setIsUpdating(true);

    try {
      // Get changed fields only
      const changedData: Partial<ProfileSchema> = {};
      if (user) {
        if (values.name !== user.name) changedData.name = values.name;
      }

      // Handle email change
      if (user && values.email !== user.email) {
        try {
          const response = await fetch("/api/auth/change-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newEmail: values.email }),
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

            throw new Error(data.error);
          }

          if (data.requiresTwoFactor) {
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
        const response = await fetch("/api/auth/user/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: changedData }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        await updateUser({ ...user!, ...changedData });

        toast.success("Profile updated", {
          description: "Your profile has been updated successfully.",
          duration: 3000,
        });
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "Failed to update profile",
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
                        disabled={isUpdating}
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
                        disabled={isUpdating}
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
          <Button type="submit" form="account-form" disabled={isUpdating}>
            Save
          </Button>
        </SettingCard.Footer>
      </SettingCard>

      <SettingCard icon={UserIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Delete account</SettingCard.Title>
          <SettingCard.Description>
            Permanently delete your account.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <DeleteAccount>
            <Button variant="destructive">Delete account</Button>
          </DeleteAccount>
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
            <TwoFactorVerifyForm
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
