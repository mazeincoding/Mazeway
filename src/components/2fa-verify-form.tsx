"use client";

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
  twoFactorVerificationSchema,
  type TwoFactorVerificationSchema,
} from "@/utils/validation/auth-validation";
import { TTwoFactorMethod } from "@/types/auth";
import { useState, useEffect } from "react";
import { useUserStore } from "@/store/user-store";
import { toast } from "sonner";
import { getMostTrustedTwoFactorMethod } from "@/utils/auth";

interface TwoFactorMethod {
  type: TTwoFactorMethod;
  factorId: string;
}

interface TwoFactorVerifyFormProps {
  factorId: string;
  availableMethods?: TwoFactorMethod[];
  onVerify: (code: string) => Promise<void>;
  onMethodChange?: (method: TwoFactorMethod) => void;
  isVerifying?: boolean;
  error?: string | null;
}

export function TwoFactorVerifyForm({
  factorId,
  availableMethods = [],
  onVerify,
  onMethodChange,
  isVerifying = false,
  error,
}: TwoFactorVerifyFormProps) {
  const { refreshUser } = useUserStore();
  const form = useForm<TwoFactorVerificationSchema>({
    resolver: zodResolver(twoFactorVerificationSchema),
    defaultValues: {
      factorId,
      code: "",
      method:
        availableMethods.find((m) => m.factorId === factorId)?.type ||
        "authenticator",
    },
    mode: "onSubmit",
  });

  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    setApiError(error || null);
  }, [error]);

  const onSubmit = form.handleSubmit(async (data) => {
    console.log("Form submitted");
    await handleSubmit(data);
  });

  const handleCodeChange = (
    value: string,
    onChange: (value: string) => void
  ) => {
    setApiError(null);

    // Only allow numbers and limit to 6 digits
    const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);

    // Reset the entire form state
    form.reset(
      {
        ...form.getValues(),
        code: sanitizedValue,
      },
      {
        keepValues: true,
        keepDirty: false,
        keepErrors: false,
        keepTouched: false,
        keepSubmitCount: false,
        keepIsSubmitted: false,
        keepIsValid: false,
      }
    );
    onChange(sanitizedValue);
  };

  console.log(availableMethods);

  const currentMethod = getMostTrustedTwoFactorMethod(availableMethods)?.type;

  const handleMethodChange = (value: string) => {
    const method = availableMethods.find((m) => m.type === value);
    if (method && onMethodChange) {
      onMethodChange(method);
    }
  };

  async function handleSubmit(data: TwoFactorVerificationSchema) {
    try {
      await onVerify(data.code);
      await refreshUser();
    } catch (error) {
      toast.error("Error", {
        description: "Failed to verify 2FA",
        duration: 3000,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        {availableMethods.length > 1 && (
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification method</FormLabel>
                <Select
                  value={currentMethod}
                  onValueChange={handleMethodChange}
                  disabled={isVerifying}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableMethods.map((method) => (
                      <SelectItem key={method.type} value={method.type}>
                        {method.type === "authenticator"
                          ? "Authenticator app"
                          : "SMS"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {currentMethod === "authenticator"
                  ? "Enter the code from your authenticator app"
                  : "Enter the code sent to your phone"}
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={field.value}
                  onChange={(e) =>
                    handleCodeChange(e.target.value, field.onChange)
                  }
                  disabled={isVerifying}
                />
              </FormControl>
              <FormMessage>
                {apiError || form.formState.errors.code?.message}
              </FormMessage>
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isVerifying}>
          {isVerifying ? "Verifying..." : "Verify"}
        </Button>
      </form>
    </Form>
  );
}
