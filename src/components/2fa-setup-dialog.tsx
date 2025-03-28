"use client";
import { useState, useEffect } from "react";
import { TTwoFactorMethod, TVerificationFactor } from "@/types/auth";
import { Check, Copy, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "./ui/phone-input";
import Image from "next/image";
import type { E164Number } from "libphonenumber-js/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VerifyForm } from "./verify-form";

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: TTwoFactorMethod;
  onSetup: (method: TTwoFactorMethod, phone?: string) => Promise<void>;
  onVerify: (
    method: TTwoFactorMethod,
    code: string,
    phone?: string
  ) => Promise<void>;
  qrCode?: string;
  secret?: string;
  backupCodes?: string[];
  isVerifying?: boolean;
  verificationError?: string | null;
  setVerificationError: (error: string | null) => void;
  requiresVerification?: boolean;
  verificationMethods?: TVerificationFactor[];
  onVerificationComplete?: () => void;
}

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  method,
  onSetup,
  onVerify,
  qrCode,
  secret,
  backupCodes,
  isVerifying = false,
  verificationError = null,
  setVerificationError,
  requiresVerification = false,
  verificationMethods = [],
  onVerificationComplete,
}: TwoFactorSetupDialogProps) {
  const [setupStep, setSetupStep] = useState<
    "verification" | "initial" | "verify" | "backup-codes"
  >(requiresVerification ? "verification" : "initial");
  const [phone, setPhone] = useState<E164Number | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);

  useEffect(() => {
    if (requiresVerification && verificationMethods.length > 0) {
      setSetupStep("verification");
    } else if (setupStep === "verification") {
      setSetupStep("initial");
    }
  }, [requiresVerification, verificationMethods, setupStep]);

  useEffect(() => {
    if (verificationComplete && backupCodes && backupCodes.length > 0) {
      console.log("Backup codes received after verification, showing them");
      setSetupStep("backup-codes");
      setVerificationComplete(false);
    }
  }, [verificationComplete, backupCodes]);

  const handleCancel = () => {
    console.log("Dialog cancel/close called. Current step:", setupStep);
    onOpenChange(false);
    setSetupStep(requiresVerification ? "verification" : "initial");
    setVerificationCode("");
    setPhone(undefined);
    setPhoneError(null);
    setVerificationComplete(false);
  };

  const handlePhoneSubmit = async () => {
    if (!phone) {
      setPhoneError("Phone number is required");
      return;
    }

    try {
      await onSetup(method, phone);
      setSetupStep("verify");
    } catch (err) {
      setPhoneError(
        err instanceof Error ? err.message : "Failed to send verification code"
      );
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) return;

    try {
      console.log("Starting verification in dialog...");
      await onVerify(method, verificationCode, phone);
      console.log("Verification complete, waiting for backup codes");
      setVerificationComplete(true);

      // Don't close or change state here - let the useEffect handle it
      // when the backup codes arrive
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationComplete(false);
    }
  };

  const handleVerifyIdentity = async (code: string) => {
    try {
      if (onVerificationComplete) {
        await onVerificationComplete();
        setSetupStep("initial");
      }
    } catch (error) {
      console.error("Identity verification error:", error);
    }
  };

  const handleCopy = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyBackupCodes = async () => {
    if (backupCodes && backupCodes.length > 0) {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

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

  const handleVerificationCodeChange = (value: string) => {
    const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
    setVerificationCode(sanitizedValue);
  };

  const encodeDataUrl = (url: string) => {
    if (!url.startsWith("data:")) return url;
    const [prefix, content] = url.split(",");
    return `${prefix},${encodeURIComponent(content)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {setupStep === "verification"
              ? "Verify your identity"
              : setupStep === "backup-codes"
                ? "Save your backup codes"
                : `Set up ${method === "authenticator" ? "Authenticator App" : "SMS"} Authentication`}
          </DialogTitle>
          <DialogDescription>
            {setupStep === "verification"
              ? "Please verify your identity to enable two-factor authentication."
              : setupStep === "initial"
                ? method === "authenticator"
                  ? "Scan the QR code with your authenticator app to get started."
                  : "Enter your phone number to receive verification codes via SMS."
                : setupStep === "verify"
                  ? "Enter the verification code to complete setup."
                  : "Store these backup codes in a safe place. You can use them to sign in if you lose access to your authentication device."}
          </DialogDescription>
        </DialogHeader>

        {setupStep === "verification" && verificationMethods.length > 0 && (
          <VerifyForm
            availableMethods={verificationMethods}
            onVerify={handleVerifyIdentity}
            isVerifying={isVerifying}
            error={verificationError}
            setError={setVerificationError}
          />
        )}

        {method === "sms" && setupStep === "initial" && (
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
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={handlePhoneSubmit}
                disabled={!phone}
              >
                Send verification code
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {method === "authenticator" &&
          setupStep === "initial" &&
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
                  onClick={() => setSetupStep("verify")}
                >
                  Continue
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

        {setupStep === "verify" && (
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
                {isVerifying ? "Verifying..." : "Verify and Enable"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSetupStep("initial")}
              >
                Go back
              </Button>
            </div>
          </div>
        )}

        {setupStep === "backup-codes" &&
          backupCodes &&
          backupCodes.length > 0 && (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertTitle>Important!</AlertTitle>
                <AlertDescription>
                  These backup codes will only be shown once. Save them
                  somewhere safe.
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
                        <Check className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 flex-shrink-0 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleDownloadBackupCodes}
                  >
                    <Download className="mr-2 flex-shrink-0 h-4 w-4" />
                    Download
                  </Button>
                </div>
                <Button onClick={handleCancel}>
                  I've saved my backup codes
                </Button>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
