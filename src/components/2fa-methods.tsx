import { useState } from "react";
import { AUTH_CONFIG } from "@/config/auth";
import { TTwoFactorMethod } from "@/types/auth";
import { QrCodeIcon, MessageCircleIcon, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePhoneNumber } from "@/utils/validation/auth-validation";
import { PhoneInput } from "./ui/phone-input";
import Image from "next/image";
import type { E164Number } from "libphonenumber-js/core";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface TwoFactorMethodsProps {
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

export function TwoFactorMethods({
  enabledMethods,
  onMethodSetup,
  onMethodDisable,
  onVerify,
  qrCode,
  secret,
  isVerifying = false,
  verificationError = null,
}: TwoFactorMethodsProps) {
  // Method-specific states
  const [selectedMethod, setSelectedMethod] = useState<TTwoFactorMethod | null>(
    null
  );
  const [phone, setPhone] = useState<E164Number | undefined>(undefined);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Loading states
  const [isMethodLoading, setIsMethodLoading] = useState<
    Record<string, boolean>
  >({});
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handleMethodToggle = async (
    method: TTwoFactorMethod,
    shouldEnable: boolean
  ) => {
    try {
      setIsMethodLoading((prev) => ({ ...prev, [method]: true }));

      if (shouldEnable) {
        if (method === "sms") {
          setSelectedMethod(method);
        } else {
          await onMethodSetup(method, "");
        }
      } else {
        await onMethodDisable(method, "");
        setSelectedMethod(null);
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to update 2FA method. Please try again.",
      });
    } finally {
      setIsMethodLoading((prev) => ({ ...prev, [method]: false }));
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
      await onMethodSetup(selectedMethod, "", phone);
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
    authenticator: <QrCodeIcon className="h-6 w-6" />,
    sms: <MessageCircleIcon className="h-6 w-6" />,
  };

  const encodeDataUrl = (url: string) => {
    if (!url.startsWith("data:")) return url;
    const [prefix, content] = url.split(",");
    return `${prefix},${encodeURIComponent(content)}`;
  };

  return (
    <div className="space-y-6">
      {/* Method selection */}
      <div className="space-y-6">
        {AUTH_CONFIG.twoFactorAuth.methods
          .filter((method) => method.enabled)
          .map((method) => {
            const isEnabled = enabledMethods.includes(method.type);
            const isLoading = isMethodLoading[method.type];

            return (
              <div
                key={method.type}
                className="flex items-center justify-between border p-4 px-6 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
                    {methodIcons[method.type]}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold">{method.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {method.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    handleMethodToggle(method.type, checked)
                  }
                  disabled={isLoading}
                />
              </div>
            );
          })}
      </div>

      {/* SMS setup */}
      {selectedMethod === "sms" && !verificationCode && (
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
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Authenticator setup */}
      {selectedMethod === "authenticator" && qrCode && secret && (
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
            <Button className="w-full" onClick={() => setVerificationCode("")}>
              Continue
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSelectedMethod(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Verification code input */}
      {selectedMethod && verificationCode !== undefined && (
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
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
