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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
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

  // Debug form state
  useEffect(() => {
    console.log("Form State:", {
      isDirty: form.formState.isDirty,
      isSubmitted: form.formState.isSubmitted,
      submitCount: form.formState.submitCount,
      errors: form.formState.errors,
      touchedFields: form.formState.touchedFields,
    });
  }, [form.formState]);

  // Debug API error changes
  useEffect(() => {
    console.log("API Error changed:", { error, apiError });
  }, [error, apiError]);

  useEffect(() => {
    setApiError(error || null);
  }, [error]);

  const onSubmit = form.handleSubmit(async (data) => {
    console.log("Form submitted with:", data);
    await onVerify(data.code);
  });

  const handleCodeChange = (
    value: string,
    onChange: (value: string) => void
  ) => {
    console.log("Code changing to:", value);
    console.log("Current form errors:", form.formState.errors);

    setApiError(null);
    // Reset the entire form state
    form.reset(
      {
        ...form.getValues(),
        code: value,
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
    onChange(value);

    console.log("After clearing - form errors:", form.formState.errors);
  };

  const currentMethod = availableMethods.find(
    (m) => m.factorId === factorId
  )?.type;

  const handleMethodChange = (value: string) => {
    const method = availableMethods.find((m) => m.type === value);
    if (method && onMethodChange) {
      onMethodChange(method);
    }
  };

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
                <InputOTP
                  maxLength={6}
                  className="gap-2"
                  value={field.value}
                  onChange={(value) => handleCodeChange(value, field.onChange)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
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
