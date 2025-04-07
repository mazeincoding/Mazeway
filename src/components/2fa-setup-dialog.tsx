"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TTwoFactorMethod } from "@/types/auth";
import { AUTH_CONFIG } from "@/config/auth";
import Image from "next/image";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PhoneInput } from "./ui/phone-input";
import { Check, Copy, Download, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/utils/api";
import { toast } from "sonner";
import type { E164Number } from "libphonenumber-js/core";

const encodeDataUrl = (url: string) => {
  if (!url.startsWith("data:")) return url;
  const [prefix, content] = url.split(",");
  return `${prefix},${encodeURIComponent(content)}`;
};

export function TwoFactorSetupDialog({
  isOpen,
  onClose,
  method,
  qrCode,
  secret,
  phone,
}: {
  isOpen: boolean;
  onClose: () => void;
  method: TTwoFactorMethod;
  qrCode: string;
  secret: string;
  phone?: string;
}) {
  const [step, setStep] = useState<"setup" | "verify" | "backup-codes">(
    "setup"
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<E164Number | undefined>(
    phone ? (phone as E164Number) : undefined
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [shouldResetState, setShouldResetState] = useState(false);

  // Reset state when the dialog is fully closed (not visible)
  useEffect(() => {
    if (!isOpen && shouldResetState) {
      // Reset all state variables
      setStep("setup");
      setVerificationCode("");
      setError(null);
      setBackupCodes([]);
      setCopied(false);
      setCopiedBackupCodes(false);
      setShouldResetState(false);
    }
  }, [isOpen, shouldResetState]);

  if (method === "backup_codes") {
    return null;
  }

  const methodConfig = AUTH_CONFIG.verificationMethods.twoFactor[method];
  const methodName = methodConfig.title;

  const handleVerificationCodeChange = (value: string) => {
    // Clear error when user types
    setError(null);

    // Format based on method
    if (method === "authenticator" || method === "sms") {
      const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
      setVerificationCode(sanitizedValue);
    } else {
      setVerificationCode(value);
    }
  };

  // Handle copying secret key to clipboard
  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Handle copying backup codes to clipboard
  const handleCopyBackupCodes = async () => {
    if (!backupCodes || backupCodes.length === 0) return;

    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    } catch (error) {
      console.error("Failed to copy backup codes:", error);
    }
  };

  // Handle downloading backup codes
  const handleDownloadBackupCodes = () => {
    if (!backupCodes || backupCodes.length === 0) return;

    const content = `BACKUP CODES FOR YOUR ACCOUNT\n\n${backupCodes.join("\n")}\n\nKeep these codes safe and secure. Each code can only be used once.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle SMS phone number verification
  const handlePhoneSubmit = async () => {
    if (!phoneNumber) {
      setPhoneError("Phone number is required");
      return;
    }

    setPhoneError(null);
    setStep("verify");
  };

  // Handle verification
  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError("Please enter a valid verification code");
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);

      // Call the verification API
      const response = await api.auth.verify({
        code: verificationCode,
        method: method,
        phone: method === "sms" ? phoneNumber : undefined,
      });

      // If successful and we get backup codes, show them
      if (response.backup_codes && response.backup_codes.length > 0) {
        setBackupCodes(response.backup_codes);
        setStep("backup-codes");
      } else {
        // No backup codes, just close
        toast.success(`${methodName} enabled successfully`);
        closeDialog();
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to verify code. Please try again."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle dialog close
  const closeDialog = () => {
    onClose();
    setShouldResetState(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "backup-codes"
              ? "Save your backup codes"
              : `Set up ${methodName}`}
          </DialogTitle>
          <DialogDescription>
            {step === "setup"
              ? method === "authenticator"
                ? "Scan the QR code with your authenticator app to get started."
                : "Enter your phone number to receive verification codes via SMS."
              : step === "verify"
                ? "Enter the verification code to complete setup."
                : "Store these backup codes in a safe place. You can use them to sign in if you lose access to your authentication device."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Setup - Show QR code or phone input */}
        {step === "setup" && (
          <>
            {method === "authenticator" ? (
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="flex flex-col items-center justify-center w-56 h-56">
                  <Image
                    src={encodeDataUrl(qrCode)}
                    className="h-full w-full"
                    alt="QR Code"
                    width={200}
                    height={200}
                  />
                </div>

                <div className="w-full flex flex-col gap-2">
                  <Label>Or enter the code manually</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={secret}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopySecret}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full pt-2">
                  <Button className="w-full" onClick={() => setStep("verify")}>
                    Continue
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={closeDialog}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : method === "sms" ? (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <PhoneInput
                    value={phoneNumber}
                    onChange={(value) => {
                      setPhoneNumber(value);
                      setPhoneError(null);
                    }}
                    defaultCountry="US"
                  />
                  {phoneError && (
                    <p className="text-sm text-destructive">{phoneError}</p>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    className="w-full"
                    onClick={handlePhoneSubmit}
                    disabled={!phoneNumber}
                  >
                    Send verification code
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={closeDialog}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Step 2: Verification - Enter the code */}
        {step === "verify" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                inputMode={
                  method === "authenticator" || method === "sms"
                    ? "numeric"
                    : "text"
                }
                pattern={
                  method === "authenticator" || method === "sms"
                    ? "[0-9]*"
                    : undefined
                }
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => handleVerificationCodeChange(e.target.value)}
                disabled={isVerifying}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={isVerifying || !verificationCode}
              >
                {isVerifying ? "Verifying..." : "Verify and Enable"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("setup")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Backup Codes - Show and save */}
        {step === "backup-codes" && backupCodes.length > 0 && (
          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTitle>Important!</AlertTitle>
              <AlertDescription>
                These backup codes will only be shown once. Save them somewhere
                safe.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div key={index} className="p-1">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopyBackupCodes}
                >
                  {copiedBackupCodes ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDownloadBackupCodes}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
              <Button onClick={closeDialog}>I've saved my backup codes</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
