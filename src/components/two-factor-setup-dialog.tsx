"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { TTwoFactorMethod } from "@/types/auth";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Check, Copy, MessageCircleIcon, QrCodeIcon } from "lucide-react";
import { AUTH_CONFIG } from "@/config/auth";
import Image from "next/image";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { InputOTP, InputOTPSlot } from "./ui/input-otp";

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Only needed for authenticator app
  qrCode: string;
  secret: string;
  onVerify: (method: TTwoFactorMethod, code: string) => Promise<void>;
  isVerifying: boolean;
  error: string | null;
}

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  qrCode,
  secret,
  onVerify,
  isVerifying,
  error,
}: TwoFactorSetupDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="space-y-3">
          <DialogTitle>Turn on Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Add an extra layer of security to your account.
          </DialogDescription>
        </DialogHeader>
        {!selectedMethod ? (
          <SelectMethod onSelect={setSelectedMethod} />
        ) : selectedMethod === "authenticator" ? (
          <AuthenticatorAppMethod
            qrCode={qrCode}
            secret={secret}
            setSelectedMethod={setSelectedMethod}
            onVerify={onVerify}
            isVerifying={isVerifying}
            error={error}
            selectedMethod={selectedMethod}
          />
        ) : (
          <></>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SelectMethod({
  onSelect,
}: {
  onSelect: (method: TTwoFactorMethod) => void;
}) {
  const methodIcons: Record<TTwoFactorMethod, React.ReactNode> = {
    authenticator: <QrCodeIcon />,
    sms: <MessageCircleIcon />,
  } as const;

  const methods = AUTH_CONFIG.twoFactorAuth.methods.filter(
    (method) => method.enabled
  );

  return (
    <div className="flex flex-col gap-4">
      {methods.map((method) => (
        <Card
          key={method.title}
          className="p-4 hover:bg-muted cursor-pointer transition-colors"
          onClick={() => onSelect(method.type)}
        >
          <CardHeader className="p-0 flex-row items-center gap-4">
            <div>{methodIcons[method.type]}</div>
            <div className="flex flex-col gap-2">
              <CardTitle>{method.title}</CardTitle>
              <CardDescription>{method.description}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function AuthenticatorAppMethod({
  qrCode,
  secret,
  setSelectedMethod,
  onVerify,
  isVerifying,
  error,
  selectedMethod,
}: {
  qrCode: string;
  secret: string;
  setSelectedMethod: (method: TTwoFactorMethod | null) => void;
  onVerify: (method: TTwoFactorMethod, code: string) => Promise<void>;
  isVerifying: boolean;
  error: string | null;
  selectedMethod: TTwoFactorMethod;
}) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");

  const handleContinue = () => {
    setStep(1);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      return;
    }
    setSelectedMethod(null);
  };

  const handleCopy = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    await onVerify(selectedMethod, code);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {step === 0 ? (
        <>
          <div className="flex flex-col items-center justify-center w-48 h-48">
            <Image
              src={qrCode}
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
            <Button className="w-full" onClick={handleContinue}>
              Continue
            </Button>
            <Button variant="outline" className="w-full" onClick={handleBack}>
              Back
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-4 w-full">
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
            {error && (
              <p className="text-sm text-destructive w-full">{error}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleBack}>
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
