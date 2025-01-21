"use client";
import { useState, useEffect } from "react";
import { TwoFactorSetupDialog } from "@/components/2fa-setup-dialog";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";
import { TTwoFactorMethod } from "@/types/auth";

export default function TwoFactorPreviewPage() {
  const [open, setOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate QR code and secret for demo purposes
  const secret = "ABCD EFGH IJKL MNOP";
  const [qrCode, setQrCode] = useState("");

  // Generate QR code on mount
  useEffect(() => {
    QRCode.toDataURL(secret, (err, url) => {
      if (!err) {
        setQrCode(url);
      }
    });
  }, []);

  const handleVerify = async (method: TTwoFactorMethod, code: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (code !== "123456") {
        throw new Error("Invalid code");
      }

      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-8">Two-Factor Setup Preview</h1>

      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Two-Factor Setup Dialog
          </h2>
          <Button onClick={() => setOpen(true)}>Open Dialog</Button>
          <TwoFactorSetupDialog
            open={open}
            onOpenChange={setOpen}
            qrCode={qrCode}
            secret={secret}
            onVerify={handleVerify}
            isVerifying={isVerifying}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
