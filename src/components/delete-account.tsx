import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TwoFactorVerifyForm } from "./2fa-verify-form";
import { TTwoFactorMethod } from "@/types/auth";

export default function DeleteAccount({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{
      type: TTwoFactorMethod;
      factorId: string;
    }>;
  } | null>(null);
  const router = useRouter();

  const handleDelete = async (code?: string) => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch("/api/auth/user/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        ...(code && twoFactorData
          ? {
              body: JSON.stringify({
                factorId: twoFactorData.factorId,
                code,
              }),
            }
          : {}),
      });

      const data = await response.json();

      if (response.status === 428 && data.requiresTwoFactor) {
        // 2FA required
        setTwoFactorData({
          factorId: data.factorId,
          availableMethods: data.availableMethods,
        });
        return;
      }

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 4000,
          });
          return;
        }
        throw new Error(data.error || "Failed to delete account");
      }

      // Success - close dialog and redirect to home
      setIsOpen(false);
      toast.success("Account deleted", {
        description: "Your account has been permanently deleted.",
      });
      router.push("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete account";
      setError(message);
      toast.error("Error", {
        description: message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerify2FA = async (code: string) => {
    await handleDelete(code);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            Warning: This will permanently delete your account and all your
            data. This action is irreversible.
          </DialogDescription>
        </DialogHeader>

        {twoFactorData ? (
          <TwoFactorVerifyForm
            factorId={twoFactorData.factorId}
            availableMethods={twoFactorData.availableMethods}
            onVerify={handleVerify2FA}
            isVerifying={isDeleting}
            error={error}
          />
        ) : (
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
