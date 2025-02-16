"use client";
import { useState } from "react";
import { TTwoFactorMethod } from "@/types/auth";
import { Check, Copy } from "lucide-react";
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
  isVerifying?: boolean;
  verificationError?: string | null;
}

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  method,
  onSetup,
  onVerify,
  qrCode,
  secret,
  isVerifying = false,
  verificationError = null,
}: TwoFactorSetupDialogProps) {
  const [setupStep, setSetupStep] = useState<"initial" | "verify">("initial");
  const [phone, setPhone] = useState<E164Number | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCancel = () => {
    onOpenChange(false);
    setSetupStep("initial");
    setVerificationCode("");
    setPhone(undefined);
    setPhoneError(null);
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
      await onVerify(method, verificationCode, phone);
      handleCancel();
    } catch (error) {
      console.error("Verification error:", error);
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
            Set up {method === "authenticator" ? "Authenticator App" : "SMS"}{" "}
            Authentication
          </DialogTitle>
          <DialogDescription>
            {setupStep === "initial"
              ? method === "authenticator"
                ? "Scan the QR code with your authenticator app to get started."
                : "Enter your phone number to receive verification codes via SMS."
              : "Enter the verification code to complete setup."}
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
