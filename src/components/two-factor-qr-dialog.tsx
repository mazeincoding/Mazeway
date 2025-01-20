"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";

interface TwoFactorQRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
  secret: string;
  onVerify?: (code: string) => void;
  error?: string;
  isVerifying?: boolean;
}

export function TwoFactorQRDialog({
  isOpen,
  onClose,
  qrCode,
  secret,
  onVerify,
  error,
  isVerifying,
}: TwoFactorQRDialogProps) {
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    setStep(2);
  };

  const handleVerify = () => {
    if (onVerify) {
      onVerify(code);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? "Turn on two-factor authentication"
              : "Verify two-factor code"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Open your authenticator app and scan this QR code or paste the code manually"
              : "Enter the 6-digit code from your authenticator app"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="flex flex-col items-center gap-6">
            <Image
              src={qrCode}
              alt="QR Code for 2FA"
              width={200}
              height={200}
              className="h-48 w-48"
            />

            <div className="flex w-full gap-2">
              <Input
                type="text"
                value={secret}
                readOnly
                className="font-mono"
                placeholder="Enter code manually"
              />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="text-green-500" /> : <Copy />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <InputOTP
              maxLength={6}
              className="gap-2"
              value={code}
              onChange={setCode}
            >
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTP>
          </div>
        )}

        {error && (
          <DialogDescription className="text-destructive">
            {error}
          </DialogDescription>
        )}

        <DialogFooter>
          <Button
            className="w-full"
            onClick={step === 1 ? handleContinue : handleVerify}
            disabled={isVerifying}
          >
            {step === 1 ? "Continue" : isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
