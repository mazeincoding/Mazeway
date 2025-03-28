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
  verificationSchema,
  type VerificationSchema,
} from "@/validation/auth-validation";
import { useUser } from "@/hooks/use-auth";
import { toast } from "sonner";
import { getDefaultVerificationMethod } from "@/utils/auth";
import {
  ArrowLeft,
  RotateCw,
  ShieldCheck,
  Mail,
  Key,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { TVerificationMethod, TVerificationFactor } from "@/types/auth";
import { api } from "@/utils/api";
import { cn } from "@/lib/utils";
import { AUTH_CONFIG } from "@/config/auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface VerifyFormProps {
  availableMethods: TVerificationFactor[];
  onVerify: (code: string, factorId: string) => Promise<void>;
  isVerifying?: boolean;
  error?: string | null;
}

export function VerifyForm({
  availableMethods,
  onVerify,
  isVerifying = false,
  error,
}: VerifyFormProps) {
  console.log("VerifyForm rendered:", {
    availableMethods,
  });

  const { refresh: refreshUser } = useUser();
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (error) {
      console.log("Error in useEffect (VerifyForm):", error);
    }
  }, [error]);

  const defaultMethod = getDefaultVerificationMethod(
    availableMethods.map((m) => m.type)
  );
  console.log("Default method:", defaultMethod);

  const [currentMethod, setCurrentMethod] =
    useState<TVerificationMethod | null>(defaultMethod);

  // Log initial mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const form = useForm<VerificationSchema>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
      method: currentMethod ?? "authenticator",
      factorId:
        availableMethods.find((m) => m.type === currentMethod)?.factorId ?? "",
    },
    mode: "onSubmit",
  });

  // Update form values when current method changes
  useEffect(() => {
    if (currentMethod) {
      const selectedMethod = availableMethods.find(
        (m) => m.type === currentMethod
      );
      if (selectedMethod) {
        form.setValue("method", currentMethod);
        form.setValue("factorId", selectedMethod.factorId);
      }
    }
  }, [currentMethod, availableMethods, form]);

  const methodLabels: Record<TVerificationMethod, string> = {
    authenticator: "Authenticator app",
    sms: "SMS",
    email: "Email",
    password: "Password",
    backup_codes: "Backup codes",
  };

  const methodIcons: Record<TVerificationMethod, React.ReactNode> = {
    authenticator: <ShieldCheck className="h-5 w-5" />,
    sms: <Smartphone className="h-5 w-5" />,
    email: <Mail className="h-5 w-5" />,
    password: <Key className="h-5 w-5" />,
    backup_codes: <Key className="h-5 w-5" />,
  };

  const methodInputLabels: Record<TVerificationMethod, string> = {
    authenticator: "Enter the code from your authenticator app",
    sms: "Enter the code sent to your phone",
    email: "Enter the code sent to your email",
    password: "Enter your password",
    backup_codes: "Enter a backup code",
  };

  const handleSendEmailCode = async () => {
    if (currentMethod !== "email") return;

    try {
      setIsResending(true);
      await api.auth.sendEmailVerification();
      setEmailCodeSent(true);
      toast.success("Code sent", {
        description: "A verification code has been sent to your email.",
        duration: 3000,
      });
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleResendCode = async () => {
    if (currentMethod !== "email") return;

    try {
      setIsResending(true);
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
      setIsResending(false);
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
          // For word-based backup codes:
          // 1. Convert multiple spaces/hyphens to single hyphens
          // 2. Remove any non-word characters except hyphens
          sanitizedValue = value
            .toLowerCase()
            .replace(/[^a-z\-\s]/g, "")
            .replace(/[\s\-]+/g, "-")
            .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
        }
        break;
      case "password":
        sanitizedValue = value;
        break;
      default:
        sanitizedValue = value;
    }

    form.setValue("code", sanitizedValue, {
      shouldValidate: true,
    });
    onChange(sanitizedValue);
  };

  const handleMethodChange = async (value: TVerificationMethod) => {
    const method = availableMethods.find((m) => m.type === value);
    if (!method) return;

    setCurrentMethod(value);
    form.setValue("code", "");
    form.setValue("method", value);
    form.setValue("factorId", method.factorId);

    // Reset email sent state when changing methods
    if (value === "email") {
      setEmailCodeSent(false);
    }
  };

  const handleBackToDefault = () => {
    setShowOtherMethods(false);
    if (defaultMethod) {
      const method = availableMethods.find((m) => m.type === defaultMethod);
      if (method) {
        setCurrentMethod(method.type);

        // Reset email sent state when going back to default
        if (method.type === "email") {
          setEmailCodeSent(false);
        }
      }
    }
  };

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const selectedMethod = availableMethods.find(
        (m) => m.type === currentMethod
      );
      if (!selectedMethod) {
        throw new Error("No verification method selected");
      }
      await onVerify(data.code, selectedMethod.factorId);
      await refreshUser();
    } catch (error) {
      console.error("Error in verification:", error);
      form.setError("code", {
        type: "manual",
        message: error instanceof Error ? error.message : "Verification failed",
      });
      return false;
    }
  });

  const codeField = (
    <FormField
      control={form.control}
      name="code"
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>
            {currentMethod ? methodInputLabels[currentMethod] : "Enter code"}
          </FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                value={field.value}
                onChange={(e) =>
                  handleCodeChange(e.target.value, field.onChange)
                }
                type={currentMethod === "password" ? "password" : "text"}
                inputMode={
                  ((currentMethod === "authenticator" ||
                    currentMethod === "sms") as boolean)
                    ? "numeric"
                    : "text"
                }
                pattern={
                  ((currentMethod === "authenticator" ||
                    currentMethod === "sms") as boolean)
                    ? "[0-9]*"
                    : undefined
                }
                maxLength={
                  ((currentMethod === "authenticator" ||
                    currentMethod === "sms") as boolean)
                    ? 6
                    : currentMethod === "email"
                      ? AUTH_CONFIG.emailVerification.codeLength
                      : currentMethod === "backup_codes" &&
                          AUTH_CONFIG.backupCodes.format === "alphanumeric"
                        ? AUTH_CONFIG.backupCodes.alphanumericLength
                        : undefined
                }
                placeholder={
                  ((currentMethod === "authenticator" ||
                    currentMethod === "sms") as boolean)
                    ? "000000"
                    : currentMethod === "email"
                      ? "Enter code"
                      : currentMethod === "backup_codes"
                        ? "Enter a backup code you saved"
                        : "Enter password"
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
            {fieldState.error?.message ||
              form.formState.errors.code?.message ||
              error}
          </FormMessage>

          {currentMethod === "email" && emailCodeSent && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Code sent to your email
            </p>
          )}
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        {showOtherMethods ? (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 -ml-2"
              onClick={handleBackToDefault}
            >
              <ArrowLeft className="h-4 w-4 flex-shrink-0" />
              Back to default method
            </Button>
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormLabel>Select verification method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) =>
                        handleMethodChange(value as TVerificationMethod)
                      }
                      defaultValue={currentMethod ?? undefined}
                      value={currentMethod ?? undefined}
                      disabled={isVerifying}
                      className="space-y-2"
                    >
                      {availableMethods.map((method) => (
                        <label
                          key={method.type}
                          className={cn(
                            "flex items-center justify-between border p-3 rounded-md cursor-pointer hover:bg-accent",
                            currentMethod === method.type &&
                              "border-primary bg-accent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {methodIcons[method.type]}
                            </div>
                            <div className="flex flex-col">
                              <h3 className="text-sm font-medium">
                                {methodLabels[method.type] || method.type}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {method.type === "authenticator" &&
                                  "Use your authenticator app"}
                                {method.type === "sms" &&
                                  "Get a code via text message"}
                                {method.type === "email" &&
                                  "Get a code via email"}
                                {method.type === "password" &&
                                  "Use your account password"}
                                {method.type === "backup_codes" &&
                                  "Use your saved backup codes"}
                              </p>
                            </div>
                          </div>
                          <RadioGroupItem
                            value={method.type}
                            className="mr-1"
                          />
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => setShowOtherMethods(false)}
              disabled={!currentMethod}
            >
              Continue with{" "}
              {currentMethod
                ? methodLabels[currentMethod].toLowerCase()
                : "selected method"}
            </Button>
          </div>
        ) : (
          <>
            {currentMethod === "email" && !emailCodeSent ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-md bg-muted/30 flex flex-col gap-2 items-center text-center">
                  <Mail className="h-10 w-10 text-primary" />
                  <h3 className="font-medium">Email verification required</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll send a verification code to your email
                  </p>
                  <Button
                    type="button"
                    className="mt-2 w-full"
                    onClick={handleSendEmailCode}
                    disabled={isResending}
                  >
                    {isResending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Sending code...
                      </span>
                    ) : (
                      "Send verification code"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              codeField
            )}

            {!(currentMethod === "email" && !emailCodeSent) && (
              <div className="space-y-3 pt-2">
                <Button type="submit" className="w-full" disabled={isVerifying}>
                  {isVerifying ? "Verifying..." : "Verify"}
                </Button>

                {availableMethods.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowOtherMethods(true);
                      // Reset the form when showing other methods
                      form.reset({ ...form.getValues(), code: "" });
                    }}
                  >
                    Verify another way
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </form>
    </Form>
  );
}
