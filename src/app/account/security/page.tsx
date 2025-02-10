"use client";
import { useState, useEffect } from "react";
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
import { AUTH_CONFIG } from "@/config/auth";
import { TDeviceSession, TTwoFactorMethod } from "@/types/auth";
import { TwoFactorVerifyForm } from "@/components/2fa-verify-form";
import { useDeviceSessions } from "@/hooks/use-device-sessions";
import { Skeleton } from "@/components/ui/skeleton";
import { ManageTwoFactorDialog } from "@/components/manage-2fa";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { TGeolocationResponse } from "@/types/api";

type FormErrors = Partial<Record<keyof PasswordChangeSchema, string>>;

export default function Security() {
  const { isLoading, user } = useUserStore();
  const hasPasswordAuth = user?.has_password ?? false;
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showManage2FADialog, setShowManage2FADialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{ type: TTwoFactorMethod; factorId: string }>;
    newPassword: string;
    password: string;
  } | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const supabase = createClient();
  const { refreshUser } = useUserStore();

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

  const handlePasswordVisibilityChange = (field: string, show: boolean) => {
    setShowPasswords({
      currentPassword: show,
      newPassword: show,
    });
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

        // Handle OAuth-specific errors
        if (data.error?.includes("identity_not_found")) {
          toast.error("Cannot add password", {
            description:
              "There was an issue adding a password to your OAuth account. Please try again or contact support.",
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

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        setTwoFactorData({
          factorId: data.factorId,
          availableMethods: data.availableMethods,
          newPassword: data.newPassword,
          password: "",
        });
        setShowTwoFactorDialog(true);
        return;
      }

      // Success
      toast.success(hasPasswordAuth ? "Password updated" : "Password added", {
        description: hasPasswordAuth
          ? "Your password has been changed successfully."
          : "Password has been added to your account. You can now use it to log in.",
        duration: 3000,
      });

      // Clear form
      setFormData({
        currentPassword: "",
        newPassword: "",
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

  const handleVerify2FA = async (code: string) => {
    if (!twoFactorData) return;

    try {
      setIsVerifying(true);
      setError(null);

      // If we're disabling 2FA (no newPassword means we're disabling)
      if (!twoFactorData.newPassword) {
        const response = await fetch("/api/auth/2fa/disable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: twoFactorData.availableMethods.length > 1 ? "all" : "method",
            factorId: twoFactorData.factorId,
            method: twoFactorData.availableMethods[0].type,
            code,
            password: twoFactorData.password,
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

        // Success
        toast.success("2FA disabled", {
          description:
            twoFactorData.availableMethods.length > 1
              ? "Two-factor authentication has been disabled for your account."
              : `${twoFactorData.availableMethods[0].type === "authenticator" ? "Authenticator app" : "SMS"} has been disabled.`,
          duration: 3000,
        });

        setTwoFactorData(null);
        setShowTwoFactorDialog(false);
        await refreshUser();
        return;
      }

      // Handle password change verification (existing code)
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorId: twoFactorData.factorId,
          code,
          newPassword: twoFactorData.newPassword,
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

      // Success
      toast.success(hasPasswordAuth ? "Password updated" : "Password added", {
        description: hasPasswordAuth
          ? "Your password has been changed successfully."
          : "Password has been added to your account. You can now use it to log in.",
        duration: 3000,
      });

      // Clear form and state
      setFormData({
        currentPassword: "",
        newPassword: "",
      });
      setTwoFactorData(null);
      setShowTwoFactorDialog(false);
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
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

      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          factorId,
          code,
          method,
          phone,
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

      // Success
      toast.success("2FA enabled", {
        description: `${method === "authenticator" ? "Authenticator app" : "SMS"} has been enabled successfully.`,
        duration: 3000,
      });

      // Clear state and close dialog
      setQrCode("");
      setSecret("");
      setFactorId("");
      setError(null);
      setShowManage2FADialog(false);
      await refreshUser();
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEnable2FA = async (
    method: TTwoFactorMethod,
    password: string,
    phone?: string
  ) => {
    try {
      console.log("[DEBUG] Enabling 2FA with password:", password);
      const response = await fetch("/api/auth/2fa/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method, password, phone }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          throw new Error("Incorrect password. Please try again.");
        }
        throw new Error(data.error || "Failed to start 2FA enrollment");
      }

      const data = await response.json();

      // Store data based on method
      if (method === "authenticator") {
        setQrCode(data.qr_code);
        setSecret(data.secret);
      } else {
        // Clear authenticator-specific states if enrolling SMS
        setQrCode("");
        setSecret("");
      }
      // Store factor ID for both methods
      setFactorId(data.factor_id);
      setError(null);

      return data;
    } catch (err) {
      // Clean up all states on error
      setQrCode("");
      setSecret("");
      setFactorId("");
      setError(err instanceof Error ? err.message : "Failed to enable 2FA");
      console.error("Error enabling 2FA:", err);
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to enable 2FA",
      });
      throw err;
    }
  };

  const handleDisableMethod = async (
    method: TTwoFactorMethod,
    password: string
  ) => {
    try {
      // Get the factor ID for the method
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.all?.find(
        (f) =>
          f.status === "verified" &&
          (f.factor_type === "totp"
            ? method === "authenticator"
            : method === "sms")
      );

      if (!factor) {
        toast.error("Error", {
          description: "2FA method not found",
        });
        return;
      }

      // Show 2FA verification dialog
      setTwoFactorData({
        factorId: factor.id,
        availableMethods: [{ type: method, factorId: factor.id }],
        newPassword: "", // Not used for disabling
        password, // Store password for verification
      });
      setShowTwoFactorDialog(true);
    } catch (err) {
      console.error("Error disabling 2FA method:", err);
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to disable 2FA method",
      });
    }
  };

  const handleDisableAll = async (password: string) => {
    try {
      // Get any verified factor to use for verification
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.all?.find((f) => f.status === "verified");

      if (!factor || !factors?.all) {
        toast.error("Error", {
          description: "No active 2FA methods found",
        });
        return;
      }

      // Show 2FA verification dialog
      setTwoFactorData({
        factorId: factor.id,
        availableMethods: factors.all
          .filter((f) => f.status === "verified")
          .map((f) => ({
            type: f.factor_type === "totp" ? "authenticator" : "sms",
            factorId: f.id,
          })),
        newPassword: "", // Not used for disabling
        password, // Store password for verification
      });
      setShowTwoFactorDialog(true);
    } catch (err) {
      console.error("Error disabling 2FA:", err);
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to disable 2FA",
      });
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
          <form
            id="password-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-col gap-6">
              {hasPasswordAuth && (
                <FormField
                  id="currentPassword"
                  label="Current password"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                  error={errors.currentPassword}
                  showPassword={showPasswords.currentPassword}
                  onShowPasswordChange={(show) =>
                    handlePasswordVisibilityChange("currentPassword", show)
                  }
                />
              )}
              <FormField
                id="newPassword"
                label="New password"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={isLoading}
                error={errors.newPassword}
                showPassword={showPasswords.newPassword}
                onShowPasswordChange={(show) =>
                  handlePasswordVisibilityChange("newPassword", show)
                }
              />
            </div>
            {hasPasswordAuth && (
              <div className="mt-2">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </form>
        </SettingCard.Content>
        <SettingCard.Footer>
          <Button type="submit" form="password-form" disabled={isLoading}>
            {hasPasswordAuth ? "Update password" : "Add password"}
          </Button>
        </SettingCard.Footer>
      </SettingCard>

      {AUTH_CONFIG.twoFactorAuth.enabled && (
        <SettingCard icon={ShieldIcon}>
          <SettingCard.Header>
            <SettingCard.Title>Two-factor authentication</SettingCard.Title>
            <SettingCard.Description>
              Add an extra layer of security to your account.
            </SettingCard.Description>
          </SettingCard.Header>
          <SettingCard.Content>
            <Button onClick={() => setShowManage2FADialog(true)}>
              {user?.auth.twoFactorEnabled ? "Manage 2FA" : "Enable 2FA"}
            </Button>
          </SettingCard.Content>
        </SettingCard>
      )}

      <ManageTwoFactorDialog
        open={showManage2FADialog}
        onOpenChange={(open) => {
          setShowManage2FADialog(open);
          if (!open) {
            // Clear state when dialog closes
            setQrCode("");
            setSecret("");
            setFactorId("");
          }
        }}
        enabledMethods={user?.auth.twoFactorMethods || []}
        onMethodSetup={handleEnable2FA}
        onMethodDisable={(method: TTwoFactorMethod) =>
          handleDisableMethod(method, formData.currentPassword)
        }
        onDisableAll={(password: string) => handleDisableAll(password)}
        onVerify={handleVerifyEnrollment}
        qrCode={qrCode}
        secret={secret}
        isVerifying={isVerifying}
        verificationError={error}
      />

      <SettingCard icon={ShieldIcon}>
        <SettingCard.Header>
          <SettingCard.Title>Manage devices</SettingCard.Title>
          <SettingCard.Description>
            Manage the devices you're logged into.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <DeviceList />
        </SettingCard.Content>
      </SettingCard>
    </div>
  );
}

interface DeviceItemProps {
  deviceName: string;
  browser: string;
  deviceIcon: React.ReactNode;
  sessionId: string;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
  isCurrentDevice?: boolean;
  os: string | null;
  ipAddress?: string;
}

function DeviceItem({
  deviceName,
  browser,
  deviceIcon,
  sessionId,
  onRevoke,
  isRevoking,
  isCurrentDevice,
  os,
  ipAddress,
}: DeviceItemProps) {
  const [location, setLocation] = useState<TGeolocationResponse["data"] | null>(
    null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only fetch location when dialog opens and we haven't fetched it yet
  useEffect(() => {
    async function fetchLocation() {
      if (!ipAddress || !dialogOpen || location || isLoadingLocation) return;

      try {
        setIsLoadingLocation(true);
        setLocationError(null);
        const response = await fetch(
          `/api/auth/device-sessions/geolocation?ip=${encodeURIComponent(ipAddress)}`
        );
        const data = await response.json();

        if (!response.ok) {
          // Don't show error for local IPs
          if (!["127.0.0.1", "::1", "localhost"].includes(ipAddress)) {
            setLocationError(
              response.status === 429
                ? "Location service is busy. Try again later."
                : "Couldn't get location information."
            );
          }
          return;
        }

        setLocation(data.data);
      } catch (err) {
        console.error("Error fetching location:", err);
        setLocationError("Couldn't get location information.");
      } finally {
        setIsLoadingLocation(false);
      }
    }

    fetchLocation();
  }, [ipAddress, dialogOpen, location, isLoadingLocation]);

  const content = (
    <div
      className={cn(
        "flex items-center justify-between border p-4 rounded-lg",
        !isCurrentDevice && "cursor-pointer hover:bg-accent"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-8 h-8">{deviceIcon}</div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{deviceName}</h3>
            {isCurrentDevice && <Badge>Current device</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{browser}</p>
        </div>
      </div>
    </div>
  );

  if (isCurrentDevice) {
    return content;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{content}</DialogTrigger>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>{deviceName}</DialogTitle>
          <DialogDescription>
            This device is currently logged into your account.
          </DialogDescription>
        </DialogHeader>
        <InfoItem label="Device name" value={deviceName} />
        <InfoItem label="Browser" value={browser} />
        {os && <InfoItem label="Operating System" value={os} />}
        {location && (
          <InfoItem
            label="Location"
            value={[location.city, location.region, location.country]
              .filter(Boolean)
              .join(", ")}
          />
        )}
        {isLoadingLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin">⏳</span> Loading location...
          </div>
        )}
        {locationError && (
          <div className="text-sm text-muted-foreground">{locationError}</div>
        )}
        <DialogFooter>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onRevoke(sessionId)}
            disabled={isRevoking}
          >
            {isRevoking ? "Logging out..." : "Log out from this device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function DeviceList() {
  const { sessions, isLoading, error, refresh } = useDeviceSessions();
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{ type: TTwoFactorMethod; factorId: string }>;
    sessionId: string;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null
  );
  const [currentSession, setCurrentSession] = useState<TDeviceSession | null>(
    null
  );

  // Get the current device session
  useEffect(() => {
    async function fetchCurrentSession() {
      try {
        const response = await fetch("/api/auth/device-sessions/current");
        const data = await response.json();

        if (!response.ok) {
          console.error("[DEBUG] Failed to get current session:", data.error);
          return;
        }

        setCurrentSession(data.data);
      } catch (err) {
        console.error("[DEBUG] Error fetching current session:", err);
      }
    }

    fetchCurrentSession();
  }, []);

  // Log whenever sessions or currentSession changes
  useEffect(() => {
    console.log("[DEBUG] Current sessions:", sessions);
    console.log("[DEBUG] Current session:", currentSession);
  }, [sessions, currentSession]);

  // Sort sessions to put current device first
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.session_id === currentSession?.session_id) return -1;
    if (b.session_id === currentSession?.session_id) return 1;
    return 0;
  });

  console.log(
    "[DEBUG] Sorted sessions:",
    sortedSessions.map((s) => ({
      session_id: s.session_id,
      is_current: s.session_id === currentSession?.session_id,
      device_name: s.device.device_name,
    }))
  );

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevokingSessionId(sessionId);
      const response = await fetch(`/api/auth/device-sessions/${sessionId}`, {
        method: "DELETE",
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

        toast.error("Error", {
          description: data.error || "Failed to revoke device session",
          duration: 3000,
        });
        return;
      }

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        setTwoFactorData({
          factorId: data.factorId,
          availableMethods: data.availableMethods,
          sessionId: sessionId,
        });
        setShowTwoFactorDialog(true);
        return;
      }

      // Success
      toast.success("Device logged out", {
        description: "The device has been logged out successfully.",
        duration: 3000,
      });
      refresh();
    } catch (err) {
      console.error("Error revoking device session:", err);
      toast.error("Error", {
        description: "Failed to revoke device session",
        duration: 3000,
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleVerify2FA = async (code: string) => {
    if (!twoFactorData) return;

    try {
      setIsVerifying(true);
      setVerifyError(null);

      // Send 2FA verification to the same endpoint
      const response = await fetch(
        `/api/auth/device-sessions/${twoFactorData.sessionId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            factorId: twoFactorData.factorId,
            code,
            method:
              twoFactorData.availableMethods.find(
                (m) => m.factorId === twoFactorData.factorId
              )?.type || "authenticator",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 4000,
          });
          return;
        }

        setVerifyError(data.error || "Failed to verify code");
        return;
      }

      // Success
      toast.success("Device logged out", {
        description: "The device has been logged out successfully.",
        duration: 3000,
      });

      // Clear state and refresh list
      setTwoFactorData(null);
      setShowTwoFactorDialog(false);
      refresh();
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setVerifyError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (error) {
    return <div className="text-destructive w-full">{error}</div>;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center text-muted-foreground">No devices found</div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {sortedSessions.map((session) => (
          <DeviceItem
            key={session.id}
            sessionId={session.session_id}
            deviceName={session.device.device_name}
            browser={session.device.browser || "Unknown browser"}
            deviceIcon={
              session.device.device_name.toLowerCase().includes("iphone") ||
              session.device.device_name.toLowerCase().includes("android") ? (
                <SmartphoneIcon className="flex-shrink-0 w-8 h-8" />
              ) : (
                <LaptopMinimalIcon className="flex-shrink-0 w-8 h-8" />
              )
            }
            onRevoke={handleRevoke}
            isRevoking={revokingSessionId === session.session_id}
            isCurrentDevice={session.session_id === currentSession?.session_id}
            os={session.device.os}
            ipAddress={session.device.ip_address}
          />
        ))}
      </div>

      {showTwoFactorDialog && twoFactorData && (
        <Dialog
          open={showTwoFactorDialog}
          onOpenChange={setShowTwoFactorDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please enter your two-factor authentication code to continue.
              </DialogDescription>
            </DialogHeader>
            <TwoFactorVerifyForm
              factorId={twoFactorData.factorId}
              availableMethods={twoFactorData.availableMethods}
              onVerify={handleVerify2FA}
              isVerifying={isVerifying}
              error={verifyError}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
