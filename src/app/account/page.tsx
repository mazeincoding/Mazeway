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

type FormErrors = Partial<Record<keyof ProfileSchema, string>>;

export default function Account() {
  const { user, updateUser } = useUserStore();

  const [formData, setFormData] = useState<ProfileSchema>({
    name: "",
    email: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      profileSchema.parse(formData);
      setErrors({});

      const response = await fetch("/api/auth/user/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Update store after successful API call
      await updateUser(formData);

      toast.success("Profile updated", {
        description: "Your profile has been updated successfully.",
        duration: 3000,
      });
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
    </div>
  );
}
