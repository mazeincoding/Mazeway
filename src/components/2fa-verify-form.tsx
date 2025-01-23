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
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await onVerify(data.code);
  });

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
                <InputOTP maxLength={6} className="gap-2" {...field}>
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
