"use client";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  verificationSchema,
  type VerificationSchema,
} from "@/validation/auth-validation";
import { useUser } from "@/hooks/use-auth";
import { toast } from "sonner";
import { getDefaultVerificationMethod } from "@/utils/auth";
import { ArrowLeft, RotateCw } from "lucide-react";
import { TVerificationMethod, TVerificationFactor } from "@/types/auth";
import { api } from "@/utils/api";
import { cn } from "@/lib/utils";
import { AUTH_CONFIG } from "@/config/auth";

interface VerifyFormProps {
  factorId: string;
  availableMethods?: TVerificationFactor[];
  onVerify: (code: string) => Promise<void>;
  onMethodChange?: (method: TVerificationFactor) => void;
  isVerifying?: boolean;
  error?: string | null;
}

function useInitialEmailVerification(method: TVerificationMethod | null) {
  const hasTriedToSendRef = useRef(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const sendInitialEmail = async () => {
      // Only try to send once per component instance
      if (hasTriedToSendRef.current || method !== "email") {
        return;
      }

      console.log("Attempting to send initial email verification");
      hasTriedToSendRef.current = true;

      try {
        setIsResending(true);
        await api.auth.sendEmailVerification();
        console.log("Initial email verification sent successfully");
      } catch (error) {
        console.error("Failed to send initial email verification:", error);
        toast.error("Error", {
          description:
            error instanceof Error ? error.message : "An error occurred",
          duration: 3000,
        });
      } finally {
        setIsResending(false);
      }
    };

    sendInitialEmail();
  }, [method]); // Only depend on method

  return isResending;
}

export function VerifyForm({
  factorId,
  availableMethods = [],
  onVerify,
  onMethodChange,
  isVerifying = false,
  error,
}: VerifyFormProps) {
  console.log("VerifyForm rendered:", {
    factorId,
    availableMethods,
    currentMethod: undefined,
  });

  const { refresh: refreshUser } = useUser();
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isManualResending, setIsManualResending] = useState(false);
  const initialEmailSentRef = useRef<boolean>(false);
  const mountedRef = useRef(false);

  const defaultMethod = getDefaultVerificationMethod(
    availableMethods.map((m) => m.type)
  );
  console.log("Default method:", defaultMethod);

  const [currentMethod, setCurrentMethod] =
    useState<TVerificationMethod | null>(defaultMethod);

  // Handle initial email verification
  const isInitialSending = useInitialEmailVerification(currentMethod);

  // Combined loading state for UI
  const isResending = isInitialSending || isManualResending;

  // Log initial mount
  useEffect(() => {
    console.log("Component mounted");
    mountedRef.current = true;
    return () => {
      console.log("Component unmounted");
      mountedRef.current = false;
    };
  }, []);

  const form = useForm<VerificationSchema>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      factorId,
      code: "",
      method: currentMethod ?? "authenticator",
    },
    mode: "onSubmit",
  });

  const methodLabels: Record<TVerificationMethod, string> = {
    authenticator: "Authenticator app",
    sms: "SMS",
    email: "Email",
    password: "Password",
    backup_codes: "Backup codes",
  };

  const methodInputLabels: Record<TVerificationMethod, string> = {
    authenticator: "Enter the code from your authenticator app",
    sms: "Enter the code sent to your phone",
    email: "Enter the code sent to your email",
    password: "Enter your password",
    backup_codes: "Enter a backup code",
  };

  const handleResendCode = async () => {
    if (currentMethod !== "email") return;

    try {
      setIsManualResending(true);
      await api.auth.sendEmailVerification();
      toast.success("Code sent", {
        description: "A new verification code has been sent to your email.",
        duration: 3000,
      });
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsManualResending(false);
    }
  };

  const handleCodeChange = (
    value: string,
    onChange: (value: string) => void
  ) => {
    // Validate based on method
    let sanitizedValue = value;
    switch (currentMethod) {
      case "authenticator":
      case "sms":
        sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
        break;
      case "email":
        sanitizedValue = value.slice(
          0,
          AUTH_CONFIG.emailVerification.codeLength
        );
        break;
      case "backup_codes":
        if (AUTH_CONFIG.backupCodes.format === "alphanumeric") {
          sanitizedValue = value.slice(
            0,
            AUTH_CONFIG.backupCodes.alphanumericLength
          );
        } else {
          // For word-based backup codes, don't limit length
          sanitizedValue = value;
        }
        break;
      case "password":
        sanitizedValue = value;
        break;
      default:
        sanitizedValue = value;
    }

    form.reset(
      { ...form.getValues(), code: sanitizedValue },
      {
        keepValues: true,
        keepDirty: false,
        keepErrors: false,
      }
    );
    onChange(sanitizedValue);
  };

  const handleMethodChange = (value: TVerificationMethod) => {
    console.log("Method change requested:", { from: currentMethod, to: value });
    const method = availableMethods.find((m) => m.type === value);
    if (method && onMethodChange) {
      onMethodChange(method);
      setCurrentMethod(value);
      setShowOtherMethods(false);
      // Reset the sent state when changing methods
      initialEmailSentRef.current = false;
    }
  };

  const handleBackToDefault = () => {
    setShowOtherMethods(false);
    if (defaultMethod && onMethodChange) {
      const method = availableMethods.find((m) => m.type === defaultMethod);
      if (method) {
        onMethodChange(method);
        setCurrentMethod(method.type);
      }
    }
  };

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await onVerify(data.code);
      await refreshUser();
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {currentMethod
                  ? methodInputLabels[currentMethod]
                  : "Enter code"}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={currentMethod === "password" ? "password" : "text"}
                    inputMode={
                      currentMethod === "authenticator" ||
                      currentMethod === "sms"
                        ? "numeric"
                        : "text"
                    }
                    pattern={
                      currentMethod === "authenticator" ||
                      currentMethod === "sms"
                        ? "[0-9]*"
                        : undefined
                    }
                    maxLength={
                      currentMethod === "authenticator" ||
                      currentMethod === "sms"
                        ? 6
                        : currentMethod === "email"
                          ? AUTH_CONFIG.emailVerification.codeLength
                          : currentMethod === "backup_codes" &&
                              AUTH_CONFIG.backupCodes.format === "alphanumeric"
                            ? AUTH_CONFIG.backupCodes.alphanumericLength
                            : undefined
                    }
                    placeholder={
                      currentMethod === "authenticator" ||
                      currentMethod === "sms"
                        ? "000000"
                        : currentMethod === "email"
                          ? "Enter code"
                          : currentMethod === "backup_codes"
                            ? "Enter backup code"
                            : "Enter password"
                    }
                    value={field.value}
                    onChange={(e) =>
                      handleCodeChange(e.target.value, field.onChange)
                    }
                    disabled={isVerifying}
                    autoComplete={
                      currentMethod === "password" ? "current-password" : "off"
                    }
                    showPassword={
                      currentMethod === "password" ? showPassword : undefined
                    }
                    onShowPasswordChange={
                      currentMethod === "password" ? setShowPassword : undefined
                    }
                    className={cn(currentMethod === "email" && "pr-10")}
                  />
                  {currentMethod === "email" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleResendCode}
                      disabled={isResending || isVerifying}
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                      aria-label="Resend code"
                    >
                      <RotateCw
                        className={cn("h-4 w-4", isResending && "animate-spin")}
                      />
                    </Button>
                  )}
                </div>
              </FormControl>
              <FormMessage>
                {error || form.formState.errors.code?.message}
              </FormMessage>
            </FormItem>
          )}
        />

        {showOtherMethods ? (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 -ml-2"
              onClick={handleBackToDefault}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to default method
            </Button>
            <FormField
              control={form.control}
              name="method"
              render={() => (
                <FormItem>
                  <FormLabel>Select verification method</FormLabel>
                  <Select
                    value={currentMethod ?? undefined}
                    onValueChange={handleMethodChange}
                    disabled={isVerifying}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableMethods
                        .filter((m) => m.type !== currentMethod)
                        .map((method) => (
                          <SelectItem key={method.type} value={method.type}>
                            {methodLabels[method.type] || method.type}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
        ) : null}

        <div className="space-y-3 pt-2">
          <Button type="submit" className="w-full" disabled={isVerifying}>
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>

          {!showOtherMethods && availableMethods.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowOtherMethods(true)}
            >
              Verify another way
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
