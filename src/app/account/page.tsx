"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user-store";
import { UserIcon } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import { FormField } from "@/components/form-field";
import {
  profileSchema,
  type ProfileSchema,
} from "@/utils/validation/auth-validation";
import { z } from "zod";
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

type FormErrors = Partial<Record<keyof ProfileSchema, string>>;

export default function Account() {
  const { user, updateUser } = useUserStore();

  const [formData, setFormData] = useState<ProfileSchema>({
    name: "",
    email: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{ type: TTwoFactorMethod; factorId: string }>;
    newEmail: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

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
      setFormData((prev) => ({
        ...prev,
        email: user?.email || "",
      }));
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      // First validate the complete form data
      profileSchema.parse(formData);
      setErrors({});

      // Get changed fields only
      const changedData: Partial<ProfileSchema> = {};
      if (user) {
        if (formData.name !== user.name) changedData.name = formData.name;
      }

      // Handle email change separately
      if (user && formData.email !== user.email) {
        try {
          const response = await fetch("/api/auth/change-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ newEmail: formData.email }),
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

          // Check if 2FA is required
          if (data.requiresTwoFactor) {
            setTwoFactorData({
              factorId: data.factorId,
              availableMethods: data.availableMethods,
              newEmail: formData.email,
            });
            setShowTwoFactorDialog(true);
            return;
          }

          // If no 2FA required, show verification message
          toast.success("Verification email sent", {
            description:
              "Please check your new email address for verification.",
            duration: 5000,
          });

          // Reset form to current email since change isn't complete yet
          setFormData((prev) => ({
            ...prev,
            email: user.email,
          }));
        } catch (error) {
          toast.error("Error", {
            description:
              error instanceof Error
                ? error.message
                : "Failed to update email. Please try again.",
            duration: 3000,
          });
          return;
        }
      }

      // Handle other profile updates if any
      if (Object.keys(changedData).length > 0) {
        const response = await fetch("/api/auth/user/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: changedData }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        // Update store after successful API call
        await updateUser({ ...user!, ...changedData });

        toast.success("Profile updated", {
          description: "Your profile has been updated successfully.",
          duration: 3000,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: FormErrors = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof FormErrors] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast.error("Error", {
          description:
            error instanceof Error
              ? error.message
              : "Failed to update profile. Please try again.",
          duration: 3000,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-12">
      <SettingCard
        icon={UserIcon}
        title="Basic information"
        description="Manage your basic information."
        footer={
          <Button type="submit" form="account-form" disabled={isUpdating}>
            Save
          </Button>
        }
      >
        <form
          id="account-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
        >
          <FormField
            id="name"
            label="Name"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange}
            disabled={isUpdating}
            error={errors.name}
          />
          <FormField
            id="email"
            label="Email"
            type="email"
            placeholder="john.doe@example.com"
            value={formData.email}
            onChange={handleChange}
            disabled={isUpdating}
            error={errors.email}
          />
        </form>
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
