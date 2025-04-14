"use client";
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
import { toast } from "sonner";
import { VerifyForm } from "./verify-form";
import { TVerificationFactor } from "@/types/auth";
import { api } from "@/utils/api";
import { useUser } from "@/hooks/use-auth";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function DeleteAccount({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  const handleVerifyComplete = () => {
    deleteAccount();
    setVerificationData(null);
    setNeedsVerification(false);
  };

  const deleteAccount = async () => {
    if (!user?.name || nameInput !== user.name) {
      toast.error("Please enter your name correctly to confirm deletion");
      return;
    }

    try {
      setIsDeleting(true);
      const loadingToast = toast.loading("Deleting account", {
        description: "This may take a few moments",
      });

      // Attempt to delete the account
      const data = await api.auth.deleteAccount();

      // Check if verification is required
      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({
          availableMethods: data.availableMethods,
        });
        setNeedsVerification(true);
        toast.dismiss(loadingToast);
        return;
      }

      // If we get here, deletion proceeded (or didn't require verification)
      setIsOpen(false);
      toast.dismiss(loadingToast);
      toast.success("Account deleted successfully", {
        description:
          "Your account has been successfully deleted. Redirecting...",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {needsVerification ? "Verify your identity" : "Delete your account"}
          </DialogTitle>
          <DialogDescription>
            {needsVerification
              ? "To delete your account, please verify your identity."
              : "This action will permanently delete your account and all associated data."}
          </DialogDescription>
        </DialogHeader>

        {needsVerification && verificationData ? (
          <VerifyForm
            availableMethods={verificationData.availableMethods}
            onVerifyComplete={handleVerifyComplete}
          />
        ) : (
          <>
            <div className="pb-4 flex flex-col gap-3">
              <Label htmlFor="name" className=" block">
                To confirm, type your name:{" "}
                <span className="font-bold">{user?.name}</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={isDeleting}
              />
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => deleteAccount()}
                disabled={isDeleting || !nameInput}
              >
                {isDeleting ? "Deleting..." : "Delete account"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
