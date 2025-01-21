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
  twoFactorVerificationSchema,
  type TwoFactorVerificationSchema,
} from "@/utils/validation/auth-validation";

interface TwoFactorVerifyFormProps {
  factorId: string;
  onVerify: (code: string) => Promise<void>;
  isVerifying?: boolean;
  error?: string | null;
}

export function TwoFactorVerifyForm({
  factorId,
  onVerify,
  isVerifying = false,
  error,
}: TwoFactorVerifyFormProps) {
  const form = useForm<TwoFactorVerificationSchema>({
    resolver: zodResolver(twoFactorVerificationSchema),
    defaultValues: {
      factorId,
      code: "",
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await onVerify(data.code);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verification code</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  render={({ slots }) => (
                    <InputOTPGroup>
                      {slots.map((slot, index) => (
                        <InputOTPSlot key={index} index={index} {...slot} />
                      ))}
                    </InputOTPGroup>
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage>{error}</FormMessage>
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
