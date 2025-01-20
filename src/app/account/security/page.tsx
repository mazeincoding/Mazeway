"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user-store";
import { KeyRound, LaptopMinimalIcon, ShieldIcon } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import { FormField } from "@/components/form-field";
import {
  passwordChangeSchema,
  type PasswordChangeSchema,
} from "@/utils/validation/auth-validation";
import { z } from "zod";
import { toast } from "sonner";
import { SmartphoneIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type FormErrors = Partial<Record<keyof PasswordChangeSchema, string>>;

export default function Security() {
  const { isLoading } = useUserStore();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

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

    try {
      // Validate form data
      passwordChangeSchema.parse(formData);
      setErrors({});

      // Send request to API
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
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

        // Handle other errors
        toast.error("Error", {
          description:
            data.error || "Failed to update password. Please try again.",
          duration: 3000,
        });
        return;
      }

      // Success
      toast.success("Password updated", {
        description: "Your password has been changed successfully.",
        duration: 3000,
      });

      // Clear form
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
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
          description: "Failed to update password. Please try again.",
          duration: 3000,
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingCard
        icon={KeyRound}
        title="Change password"
        description="Update your account password."
        footer={
          <Button type="submit" form="password-form" disabled={isLoading}>
            Update password
          </Button>
        }
      >
        <form
          id="password-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
        >
          <FormField
            id="currentPassword"
            label="Current password"
            type="password"
            value={formData.currentPassword}
            onChange={handleChange}
            disabled={isLoading}
            error={errors.currentPassword}
          />
          <FormField
            id="newPassword"
            label="New password"
            type="password"
            value={formData.newPassword}
            onChange={handleChange}
            disabled={isLoading}
            error={errors.newPassword}
          />
          <FormField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            error={errors.confirmPassword}
          />
          <div className="space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating password..." : "Update password"}
            </Button>
            <div className="text-center">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>
        </form>
      </SettingCard>

      <SettingCard
        icon={ShieldIcon}
        title="Two-factor authentication"
        description="Add an extra layer of security to your account."
      >
        <Button variant="outline">Enable 2FA</Button>
      </SettingCard>

      <SettingCard
        icon={ShieldIcon}
        title="Manage devices"
        description="Manage the devices you're logged into."
      >
        <div className="flex flex-col gap-6">
          <DeviceItem
            deviceName="iPhone 11"
            browser="Safari"
            deviceIcon={<SmartphoneIcon className="flex-shrink-0 w-8 h-8" />}
            deviceStatus="active"
          />
          <DeviceItem
            deviceName="DESKTOP-ABC123"
            browser="Microsoft Edge"
            deviceIcon={<LaptopMinimalIcon className="flex-shrink-0 w-8 h-8" />}
            deviceStatus="inactive"
          />
        </div>
      </SettingCard>
    </div>
  );
}

interface DeviceItemProps {
  deviceName: string;
  browser: string;
  deviceIcon: React.ReactNode;
  deviceStatus: "active" | "inactive";
}

function DeviceItem({
  deviceName,
  browser,
  deviceIcon,
  deviceStatus,
}: DeviceItemProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer border hover:bg-accent p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-8 h-8">{deviceIcon}</div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{deviceName}</h3>
                <DeviceStatus deviceStatus={deviceStatus} />
              </div>
              <p className="text-sm text-muted-foreground">{browser}</p>
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>{deviceName}</DialogTitle>
          <DialogDescription>
            This device is currently logged into your account.
          </DialogDescription>
        </DialogHeader>
        <InfoItem label="Device name" value={deviceName} />
        <InfoItem label="Browser" value={browser} />
        <InfoItem label="OS" value="Not available" />
        <InfoItem label="IP Address" value="192.168.1.1" />
        <InfoItem label="Last active" value="1 hour ago" />
        <DialogFooter>
          <Button variant="destructive" className="w-full">
            Log out from this device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceStatus({
  deviceStatus,
}: {
  deviceStatus: "active" | "inactive";
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "w-2 h-2 rounded-full cursor-pointer",
            deviceStatus === "active" ? "bg-green-500" : "bg-red-500"
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        {deviceStatus === "active" ? "Active" : "Last active 1 hour ago"}
      </TooltipContent>
    </Tooltip>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
