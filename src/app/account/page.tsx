"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-auth";
import { InfoIcon, Trash2Icon, UserIcon } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import {
  profileSchema,
  type ProfileSchema,
} from "@/validation/auth-validation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { DeleteAccount } from "@/components/delete-account";
import { api } from "@/utils/api";
import { cn } from "@/lib/utils";
import { AUTH_CONFIG } from "@/config/auth";

function getConnectedProvidersMessage(
  identities: Array<{ provider: string }> | undefined
) {
  if (!identities?.length) return null;

  // Filter out email provider and get only enabled providers
  const connectedProviders = identities
    .filter((i) => i.provider !== "email")
    .filter((i) => {
      const provider = i.provider as keyof typeof AUTH_CONFIG.socialProviders;
      return AUTH_CONFIG.socialProviders[provider]?.enabled;
    })
    .map((i) => {
      const provider = i.provider as keyof typeof AUTH_CONFIG.socialProviders;
      return AUTH_CONFIG.socialProviders[provider].displayName;
    });

  if (!connectedProviders.length) return null;

  // Format the list of providers
  const providerList = connectedProviders.join(" or ");
  const isPlural = connectedProviders.length > 1;

  return `When signing in with ${providerList}, you'll still use the same account${isPlural ? "s" : ""} (this won't change ${isPlural ? "them" : "it"})`;
}

export default function Account() {
  const { user, isLoading: isUserLoading } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [emailChangeData, setEmailChangeData] = useState<{
    availableMethods: TVerificationFactor[];
    newEmail: string;
  } | null>(null);
  const [showEmailChangeInfoDialog, setShowEmailChangeInfoDialog] =
    useState(false);
  const [pendingEmailChange, setPendingEmailChange] = useState<string | null>(
    null
  );

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

  const handleEmailChange = async ({
    skipVerificationCheck = false,
  }: {
    skipVerificationCheck?: boolean;
  } = {}) => {
    if (!pendingEmailChange || !user) return;

    try {
      setIsUpdating(true);
      setShowEmailChangeInfoDialog(false);

      if (!skipVerificationCheck) {
        // Check if verification is needed
        const data = await api.auth.changeEmail({
          newEmail: pendingEmailChange,
          checkVerificationOnly: true,
        });

        if (
          data.requiresVerification &&
          data.availableMethods &&
          data.availableMethods.length > 0
        ) {
          setEmailChangeData({
            availableMethods: data.availableMethods,
            newEmail: pendingEmailChange,
          });
          setNeedsVerification(true);
          return;
        }
      }

      // Verification completed/not needed ->
      await api.auth.changeEmail({ newEmail: pendingEmailChange });

      // Success message for email
      toast.success("Verification emails sent", {
        description:
          "Please check both your current and new email addresses. You'll need to verify both to complete the change.",
        duration: 5000,
      });

      // Reset form fields
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
    } finally {
      setIsUpdating(false);
      setPendingEmailChange(null);
      setNeedsVerification(false);
      setEmailChangeData(null);
    }
  };

  const onSubmit = async (values: ProfileSchema) => {
    if (!user) return;
    setIsUpdating(true);

    try {
      // Store all changes
      const hasNameChange = values.name !== user.name;
      const hasEmailChange = values.email !== user.email;

      // Process name change immediately if it exists
      if (hasNameChange) {
        try {
          await api.user.update({ name: values.name });
          toast.success("Profile updated", {
            description: "Your name has been updated successfully.",
            duration: 3000,
          });
        } catch (error) {
          toast.error("Error updating name", {
            description:
              error instanceof Error ? error.message : "An error occurred",
            duration: 3000,
          });

          form.setValue("name", user.name || "");
        }
      }

      if (hasEmailChange) {
        setPendingEmailChange(values.email);
        setShowEmailChangeInfoDialog(true);
        setIsUpdating(false);
        return;
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

  const handleCancelEmailChange = () => {
    setShowEmailChangeInfoDialog(false);
    setPendingEmailChange(null);
    form.setValue("email", user?.email || "");
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
                    <FormLabel
                      className={cn(
                        !user?.has_password && "text-muted-foreground"
                      )}
                    >
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        disabled={
                          isUpdating || isUserLoading || !user?.has_password
                        }
                        {...field}
                      />
                    </FormControl>
                    {user?.has_password ? (
                      <FormMessage />
                    ) : (
                      <p className="flex gap-2 items-center text-muted-foreground text-sm pt-2 ml-1">
                        <InfoIcon className="w-4 h-4" />
                        Before you can change your email, you'll need to set up
                        a password for your account first
                      </p>
                    )}
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

      <SettingCard icon={Trash2Icon}>
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

      <Dialog
        open={showEmailChangeInfoDialog}
        onOpenChange={setShowEmailChangeInfoDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Change Information</DialogTitle>
            <DialogDescription>
              Here's what happens when you change your email:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ul className="list-disc pl-6 space-y-3 text-sm text-muted-foreground">
              <li>
                You'll receive verification emails at <strong>both</strong> your
                current and new email addresses
              </li>
              <li>
                You must verify <strong>both</strong> emails to complete the
                change (this is for security)
              </li>
              <li>
                After verification, you'll get all your account updates at your
                new email address
              </li>
              <li>
                When signing in with email and password, you'll need to use your
                new email
              </li>
              {user?.auth.identities?.some((i) => i.provider !== "email") &&
                getConnectedProvidersMessage(user?.auth.identities) && (
                  <li>{getConnectedProvidersMessage(user?.auth.identities)}</li>
                )}
            </ul>
          </div>
          <DialogFooter className="flex flex-row gap-2 pt-4">
            <Button variant="outline" onClick={handleCancelEmailChange}>
              Cancel
            </Button>
            <Button onClick={() => handleEmailChange()}>Proceed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emailChangeData && emailChangeData.availableMethods && (
        <Dialog open={needsVerification} onOpenChange={setNeedsVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please enter your two-factor authentication code to change your
                email address.
              </DialogDescription>
            </DialogHeader>
            <VerifyForm
              availableMethods={emailChangeData.availableMethods}
              onVerifyComplete={() =>
                handleEmailChange({ skipVerificationCheck: true })
              }
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
