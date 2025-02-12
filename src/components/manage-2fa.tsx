"use client";

import { useState } from "react";
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

  const encodeDataUrl = (url: string) => {
    if (!url.startsWith("data:")) return url;
    const [prefix, content] = url.split(",");
    return `${prefix},${encodeURIComponent(content)}`;
  };

  // Core states
  const [password, setPassword] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Method-specific states
  const [phone, setPhone] = useState<E164Number | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Loading states
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [isMethodLoading, setIsMethodLoading] = useState(false);
  const [isDisablingAll, setIsDisablingAll] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const clearStates = () => {
    setPassword("");
    setIsPasswordVerified(false);
    setSelectedMethod(null);
    setPhone(undefined);
    setPhoneError(null);
    setVerificationCode("");
    setCopied(false);
    setIsVerifyingPassword(false);
    setIsMethodLoading(false);
    setIsDisablingAll(false);
    setIsSendingCode(false);
    setShowCurrentPassword(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    clearStates();
  };

  const handlePasswordVerify = async () => {
    if (!password) return;

    try {
      setIsVerifyingPassword(true);
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      setIsPasswordVerified(true);
    } catch (error) {
      toast.error("Error", {
        description: "Failed to verify password. Please try again.",
      });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleMethodAction = async (method: TTwoFactorMethod) => {
    const isEnabled = enabledMethods.includes(method);

    try {
      setSelectedMethod(method);
      setIsMethodLoading(true);

      if (isEnabled) {
        await onMethodDisable(method, password);
        setSelectedMethod(null);
      } else if (method === "sms") {
        // SMS setup requires phone number first
        setSelectedMethod(method);
      } else {
        // For authenticator, directly start setup
        await onMethodSetup(method, password);
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update 2FA method. Please try again.",
      });
      setSelectedMethod(null);
    } finally {
      setIsMethodLoading(false);
    }
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

    try {
      setIsSendingCode(true);
      await onMethodSetup(selectedMethod, password, phone);
    } catch (err) {
      setPhoneError(
        err instanceof Error ? err.message : "Failed to send verification code"
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedMethod || !verificationCode) return;
    await onVerify(selectedMethod, verificationCode, phone);
  };

  const handleDisableAll = async () => {
    try {
      setIsDisablingAll(true);
      await onDisableAll(password);
      handleClose();
    } catch (error) {
      toast.error("Error", {
        description: "Failed to disable 2FA. Please try again.",
      });
    } finally {
      setIsDisablingAll(false);
    }
  };

  const handleCopy = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerificationCodeChange = (value: string) => {
    const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
    setVerificationCode(sanitizedValue);
  };

  const methodIcons: Record<TTwoFactorMethod, React.ReactNode> = {
    authenticator: <QrCodeIcon className="h-5 w-5" />,
    sms: <MessageCircleIcon className="h-5 w-5" />,
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
            {!isPasswordVerified
              ? "Please verify your identity to continue."
              : enabledMethods.length > 0
                ? "Manage your two-factor authentication methods."
                : "Add an extra layer of security to your account."}
          </DialogDescription>
        </DialogHeader>

        {/* Password verification */}
        {!isPasswordVerified && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Current Password</Label>
              <Input
                id="password"
                type={showCurrentPassword ? "text" : "password"}
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
                disabled={!password || isVerifyingPassword}
              >
                {isVerifyingPassword ? "Verifying..." : "Continue"}
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
        )}

        {/* Method selection and management */}
        {isPasswordVerified && !selectedMethod && (
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
                      <Button
                        variant={isEnabled ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleMethodAction(method.type)}
                        disabled={isMethodLoading}
                      >
                        {isMethodLoading
                          ? "Loading..."
                          : isEnabled
                            ? "Disable"
                            : "Enable"}
                      </Button>
                    </div>
                  );
                })}
            </div>

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
                  disabled={isDisablingAll}
                >
                  {isDisablingAll
                    ? "Disabling..."
                    : "Disable Two-Factor Authentication"}
                </Button>
              </>
            )}
          </div>
        )}

        {/* SMS setup */}
        {isPasswordVerified &&
          selectedMethod === "sms" &&
          !verificationCode && (
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
                  disabled={isSendingCode}
                />
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={handlePhoneSubmit}
                  disabled={isSendingCode || !phone}
                >
                  {isSendingCode ? "Sending code..." : "Send verification code"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedMethod(null)}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

        {/* Authenticator setup */}
        {isPasswordVerified &&
          selectedMethod === "authenticator" &&
          qrCode &&
          secret && (
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
                  onClick={() => setVerificationCode("")}
                >
                  Continue
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedMethod(null)}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

        {/* Verification code input */}
        {isPasswordVerified &&
          selectedMethod &&
          verificationCode !== undefined && (
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setVerificationCode("");
                    if (selectedMethod === "authenticator") {
                      setSelectedMethod(null);
                    }
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
