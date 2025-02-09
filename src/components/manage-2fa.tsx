"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIG } from "@/config/auth";
import { TTwoFactorMethod } from "@/types/auth";
import {
  QrCodeIcon,
  MessageCircleIcon,
  ShieldIcon,
  AlertTriangle,
  Check,
  Copy,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePhoneNumber } from "@/utils/validation/auth-validation";
import { PhoneInput } from "./ui/phone-input";
import Image from "next/image";
import type { E164Number } from "libphonenumber-js/core";
import { cn } from "@/lib/utils";
import { TVerifyPasswordRequest } from "@/types/api";
import { useUserStore } from "@/store/user-store";

interface TwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledMethods: TTwoFactorMethod[];
  onMethodSetup: (
    method: TTwoFactorMethod,
    password: string,
    phone?: string
  ) => Promise<void>;
  onMethodDisable: (
    method: TTwoFactorMethod,
    password: string
  ) => Promise<void>;
  onDisableAll: (password: string) => Promise<void>;
  onVerify: (
    method: TTwoFactorMethod,
    code: string,
    phone?: string
  ) => Promise<void>;
  qrCode?: string;
  secret?: string;
  isVerifying?: boolean;
  verificationError?: string | null;
}

type TSetupStep =
  | "select"
  | "setup"
  | "verify"
  | "password"
  | "password-verify";

const encodeDataUrl = (url: string) => {
  if (!url.startsWith("data:")) return url;
  const [prefix, content] = url.split(",");
  return `${prefix},${encodeURIComponent(content)}`;
};

export function ManageTwoFactorDialog({
  open,
  onOpenChange,
  enabledMethods,
  onMethodSetup,
  onMethodDisable,
  onDisableAll,
  onVerify,
  qrCode,
  secret,
  isVerifying = false,
  verificationError = null,
}: TwoFactorDialogProps) {
  const { user } = useUserStore();
  const hasPasswordAuth = user?.has_password ?? false;
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );
  const [currentStep, setCurrentStep] = useState<TSetupStep>(
    hasPasswordAuth ? "password-verify" : "select"
  );
  const [isDisabling, setIsDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [isDisablingAll, setIsDisablingAll] = useState(false);
  const [phone, setPhone] = useState<E164Number | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifiedPassword, setVerifiedPassword] = useState<string>("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  useEffect(() => {
    // Reset to appropriate initial state when auth status changes
    setCurrentStep(hasPasswordAuth ? "password-verify" : "select");
    setVerifiedPassword("");
    setSelectedMethod(null);
    setPassword("");
  }, [hasPasswordAuth]);

  const methodIcons: Record<TTwoFactorMethod, React.ReactNode> = {
    authenticator: <QrCodeIcon className="h-5 w-5" />,
    sms: <MessageCircleIcon className="h-5 w-5" />,
  };

  const handleMethodAction = async (method: TTwoFactorMethod) => {
    const isEnabled = enabledMethods.includes(method);
    try {
      setSelectedMethod(method);
      if (isEnabled) {
        setIsDisablingAll(false);
        if (hasPasswordAuth) {
          setCurrentStep("password");
        } else {
          // For non-password accounts, directly call onMethodDisable
          // Ideally, we'd show the UX to add a password instead but later on that
          await onMethodDisable(method, "");
        }
      } else {
        if (method === "sms") {
          setCurrentStep("setup");
        } else {
          setIsEnrolling(true);
          await onMethodSetup(method, hasPasswordAuth ? verifiedPassword : "");
          setCurrentStep("setup");
        }
      }
    } catch (error) {
      // Clean up states on error
      setCurrentStep(hasPasswordAuth ? "password-verify" : "select");
      setSelectedMethod(null);
      setPhone(undefined);
      setPhoneError(null);
      setVerificationCode("");
      toast.error("Error", {
        description: "Failed to update 2FA method. Please try again.",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handlePasswordVerify = async () => {
    if (!password) return;

    try {
      setIsDisabling(true);
      // Try to verify the password by making a test call
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password } satisfies TVerifyPasswordRequest),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Error", {
            description: "Incorrect password. Please try again.",
          });
          return;
        }
        throw new Error("Failed to verify password");
      }

      // Store the verified password and move to method selection
      setVerifiedPassword(password);
      setPassword("");
      setCurrentStep("select");
    } catch (error) {
      toast.error("Error", {
        description: "Failed to verify password. Please try again.",
      });
    } finally {
      setIsDisabling(false);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      setIsDisabling(true);
      if (isDisablingAll) {
        await onDisableAll(hasPasswordAuth ? password : "");
        handleClose();
      } else if (selectedMethod) {
        await onMethodDisable(selectedMethod, hasPasswordAuth ? password : "");
        setCurrentStep("select");
      }
      setPassword("");
    } catch (error) {
      toast.error("Error", {
        description: "Failed to disable 2FA. Please try again.",
      });
    } finally {
      setIsDisabling(false);
    }
  };

  const handleDisableAll = () => {
    setIsDisablingAll(true);
    setCurrentStep("password");
  };

  const handlePhoneSubmit = async () => {
    if (!phone || !selectedMethod) {
      setPhoneError("Phone number is required");
      return;
    }

    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      setPhoneError(validation.error || "Invalid phone number");
      return;
    }
    setPhoneError(null);

    try {
      setIsEnrolling(true);
      // First enroll with the phone number
      await onMethodSetup(
        selectedMethod,
        hasPasswordAuth ? verifiedPassword : "",
        phone
      );
      // Move to verification step
      setCurrentStep("verify");
    } catch (err) {
      setPhoneError(
        err instanceof Error ? err.message : "Failed to send verification code"
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleVerificationCodeChange = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
    setVerificationCode(sanitizedValue);
  };

  const handleVerify = async () => {
    if (!selectedMethod) return;
    await onVerify(selectedMethod, verificationCode);
  };

  const handleCopy = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "setup":
      case "password":
        setCurrentStep("select");
        setSelectedMethod(null);
        setPassword("");
        setPhone(undefined);
        setPhoneError(null);
        break;
      case "verify":
        if (selectedMethod === "sms") {
          setCurrentStep("setup");
        } else {
          setCurrentStep("select");
        }
        setVerificationCode("");
        break;
      case "select":
        setCurrentStep("password-verify");
        setVerifiedPassword("");
        setSelectedMethod(null);
        break;
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(hasPasswordAuth ? "password-verify" : "select");
    setSelectedMethod(null);
    setPassword("");
    setVerifiedPassword("");
    setPhone(undefined);
    setPhoneError(null);
    setVerificationCode("");
    setCopied(false);
    setIsEnrolling(false);
  };

  // Add a click handler to the disable button
  const renderMethodButton = (method: TTwoFactorMethod, isEnabled: boolean) => {
    if (isEnabled) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleMethodAction(method);
          }}
          disabled={isDisabling}
        >
          {isDisabling ? "Disabling..." : "Disable"}
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleMethodAction(method);
        }}
        disabled={isEnrolling}
      >
        Enable
      </Button>
    );
  };

  const renderContent = () => {
    switch (currentStep) {
      case "password-verify":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Current Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your current password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password) {
                    handlePasswordVerify();
                  }
                }}
                showPassword={showCurrentPassword}
                onShowPasswordChange={(show) => setShowCurrentPassword(show)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={handlePasswordVerify}
                disabled={!password || isDisabling}
              >
                {isDisabling ? "Verifying..." : "Continue"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case "select":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              {AUTH_CONFIG.twoFactorAuth.methods
                .filter((method) => method.enabled)
                .map((method) => {
                  const isEnabled = enabledMethods.includes(method.type);
                  return (
                    <div
                      key={method.type}
                      className={cn(
                        "w-full p-4 flex items-center justify-between rounded-md border gap-4",
                        "text-sm font-medium ring-offset-background"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-muted-foreground">
                          {methodIcons[method.type]}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{method.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {method.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderMethodButton(method.type, isEnabled)}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Only show Back button if we came from password verification */}
            {currentStep === "select" && verifiedPassword && (
              <Button variant="outline" className="w-full" onClick={handleBack}>
                Back
              </Button>
            )}

            {enabledMethods.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Disabling all 2FA methods will make your account less secure.
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDisableAll}
                  disabled={isDisabling}
                >
                  {isDisabling
                    ? "Disabling..."
                    : "Disable Two-Factor Authentication"}
                </Button>
              </>
            )}
          </div>
        );

      case "setup":
        if (selectedMethod === "authenticator" && qrCode && secret) {
          return (
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col items-center justify-center w-48 h-48">
                <Image
                  src={encodeDataUrl(qrCode)}
                  className="h-full w-full"
                  alt="QR Code"
                  width={200}
                  height={200}
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <p className="text-sm text-muted-foreground">
                  Or enter the code manually:
                </p>
                <div className="flex w-full gap-2">
                  <Input readOnly value={secret} className="font-mono" />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="text-green-500" /> : <Copy />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <Button
                  className="w-full"
                  onClick={() => setCurrentStep("verify")}
                >
                  Continue
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBack}
                >
                  Back
                </Button>
              </div>
            </div>
          );
        } else if (selectedMethod === "sms") {
          return (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <PhoneInput
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    setPhoneError(null);
                  }}
                  defaultCountry="US"
                  disabled={isVerifying}
                />
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={handlePhoneSubmit}
                  disabled={isEnrolling || !phone}
                >
                  {isEnrolling ? "Sending code..." : "Send verification code"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBack}
                >
                  Back
                </Button>
              </div>
            </div>
          );
        }
        return null;

      case "verify":
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-4 w-full">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => handleVerificationCodeChange(e.target.value)}
                disabled={isVerifying}
              />
              {verificationError && (
                <p className="text-sm text-destructive w-full">
                  {verificationError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={isVerifying || !verificationCode}
              >
                {isVerifying ? "Verifying..." : "Verify"}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleBack}>
                Back
              </Button>
            </div>
          </div>
        );

      case "password":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={handlePasswordSubmit}
                disabled={!password || isDisabling}
              >
                {isDisabling ? "Verifying..." : "Continue"}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleBack}>
                Back
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center sm:justify-start gap-2">
            <ShieldIcon className="h-5 w-5" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {currentStep === "password-verify"
              ? "Please verify your identity to continue."
              : currentStep === "select"
                ? enabledMethods.length > 0
                  ? "Manage your two-factor authentication methods."
                  : "Add an extra layer of security to your account."
                : currentStep === "password"
                  ? "Please enter your password to disable 2FA."
                  : "Follow the steps to set up two-factor authentication."}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
