"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-auth";
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
import { AUTH_CONFIG } from "@/config/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Check, X, Upload, Loader2 } from "lucide-react";

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

// Helper function to get first letter for avatar fallback
function getFirstLetter(name: string): string {
  return name.charAt(0).toUpperCase();
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

  // New state for inline editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Avatar upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleEmailChange = async () => {
    if (!pendingEmailChange || !user) return;

    try {
      setIsUpdating(true);
      setShowEmailChangeInfoDialog(false);
      setIsEditingEmail(false);

      // Attempt to change email
      const data = await api.auth.changeEmail({
        newEmail: pendingEmailChange,
      });

      // If verification is needed, show verification dialog
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

  const handleNameUpdate = async () => {
    if (!user) return;

    try {
      setIsUpdating(true);
      const values = form.getValues();

      if (values.name !== user.name) {
        await api.user.update({ name: values.name });
        toast.success("Profile updated", {
          description: "Your name has been updated successfully.",
          duration: 3000,
        });
      }
    } catch (error) {
      toast.error("Error updating name", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });

      form.setValue("name", user.name || "");
    } finally {
      setIsUpdating(false);
      setIsEditingName(false);
    }
  };

  const handleEmailEdit = () => {
    if (!user?.has_password) {
      toast.error("Password required", {
        description:
          "Before you can change your email, you'll need to set up a password for your account first",
        duration: 3000,
      });
      return;
    }
    setIsEditingEmail(true);
  };

  const handleEmailSubmit = async () => {
    if (!user) return;

    const values = form.getValues();
    if (values.email !== user.email) {
      setPendingEmailChange(values.email);
      setShowEmailChangeInfoDialog(true);
    }
    setIsEditingEmail(false);
  };

  const handleCancelEmailChange = () => {
    setShowEmailChangeInfoDialog(false);
    setIsEditingEmail(false);
    setPendingEmailChange(null);
    form.setValue("email", user?.email || "");
  };

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please select an image file",
        duration: 3000,
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File too large", {
        description: "Image must be less than 5MB",
        duration: 3000,
      });
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const loadingToast = toast.loading("Updating profile picture...");
      await api.user.updateAvatar(file);
      toast.dismiss(loadingToast);
      toast.success("Profile picture updated", {
        duration: 3000,
      });
    } catch (error) {
      toast.error("Upload failed", {
        description:
          error instanceof Error ? error.message : "Failed to upload image",
        duration: 3000,
      });
    } finally {
      setIsUploadingAvatar(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-2">
      <h1 className="text-3xl font-bold">Account</h1>

      {/* Profile section */}
      <section className="flex items-center gap-6">
        <div className="relative group">
          <Avatar
            className="h-20 w-20 cursor-pointer transition-all relative"
            onClick={handleAvatarClick}
          >
            <AvatarImage
              src={user?.avatar_url}
              alt="User avatar"
              className="object-cover"
            />
            <AvatarFallback className="text-lg">
              {getFirstLetter(user?.name || "U")}
            </AvatarFallback>
            <div className="absolute inset-0 bg-black/10 opacity-0 hover:opacity-100 transition-opacity rounded-full">
              {isUploadingAvatar && (
                <Loader2 className="h-6 w-6 text-white animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
          </Avatar>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            className="hidden"
            accept="image/*"
          />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-semibold">{user?.name}</h3>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </section>

      <Separator className="my-2" />

      {/* Display name section */}
      <section className="flex justify-between items-center">
        <div className="flex flex-col gap-1.5 flex-1 mr-4">
          <Label className="font-bold text-base">Display name</Label>
          {isEditingName ? (
            <div className="flex gap-2 items-center">
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-0">
                      <FormControl>
                        <Input
                          autoFocus
                          {...field}
                          disabled={isUpdating}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleNameUpdate();
                            } else if (e.key === "Escape") {
                              setIsEditingName(false);
                              form.setValue("name", user?.name || "");
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditingName(false);
                  form.setValue("name", user?.name || "");
                }}
                disabled={isUpdating}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleNameUpdate}
                disabled={isUpdating}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-base text-muted-foreground">
              {user?.name || "Not set"}
            </span>
          )}
        </div>
        {!isEditingName && (
          <Button
            variant="outline"
            onClick={() => setIsEditingName(true)}
            disabled={isUpdating || isUserLoading}
          >
            Edit
          </Button>
        )}
      </section>

      {/* Email address section */}
      <section className="flex justify-between items-center">
        <div className="flex flex-col gap-1.5 flex-1 mr-4">
          <Label className="font-bold text-base">Email address</Label>
          {isEditingEmail ? (
            <div className="flex gap-2 items-center">
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-0">
                      <FormControl>
                        <Input
                          type="email"
                          autoFocus
                          {...field}
                          disabled={isUpdating}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEmailSubmit();
                            } else if (e.key === "Escape") {
                              setIsEditingEmail(false);
                              form.setValue("email", user?.email || "");
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditingEmail(false);
                  form.setValue("email", user?.email || "");
                }}
                disabled={isUpdating}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleEmailSubmit}
                disabled={isUpdating}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-base text-muted-foreground">
              {user?.email || "Not set"}
            </span>
          )}
        </div>
        {!isEditingEmail && (
          <Button
            variant="outline"
            onClick={handleEmailEdit}
            disabled={isUpdating || isUserLoading || !user?.has_password}
          >
            Edit
          </Button>
        )}
      </section>

      <Separator className="my-2" />

      {/* Delete account section */}
      <section className="flex justify-between items-start">
        <div className="flex flex-col gap-1.5 max-w-[70%]">
          <Label className="font-bold text-base">Delete account</Label>
          <p className="text-sm text-muted-foreground">
            Once your account is deleted, all your personal information and
            settings will be permanently erased. Your account cannot be
            recovered, and all your data will be completely removed from our
            servers.
          </p>
        </div>
        <DeleteAccount>
          <Button variant="destructive">Delete</Button>
        </DeleteAccount>
      </section>

      {/* Email Change Info Dialog */}
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
              {user?.auth?.identities?.some((i) => i.provider !== "email") &&
                getConnectedProvidersMessage(user?.auth?.identities) && (
                  <li>
                    {getConnectedProvidersMessage(user?.auth?.identities)}
                  </li>
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

      {/* Verification Dialog */}
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
              onVerifyComplete={() => handleEmailChange()}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
