import { z } from "zod";
import { AUTH_CONFIG } from "@/config/auth";

export const authSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .max(255, "Email is too long")
    .email("Invalid email format"),
  password: z
    .string()
    .min(
      AUTH_CONFIG.passwordRequirements.minLength,
      `Password must be at least ${AUTH_CONFIG.passwordRequirements.minLength} characters`
    )
    .max(
      AUTH_CONFIG.passwordRequirements.maxLength,
      `Password cannot exceed ${AUTH_CONFIG.passwordRequirements.maxLength} characters`
    )
    .refine(
      (password) =>
        !AUTH_CONFIG.passwordRequirements.requireLowercase ||
        /[a-z]/.test(password),
      "Password must contain at least one lowercase letter"
    )
    .refine(
      (password) =>
        !AUTH_CONFIG.passwordRequirements.requireUppercase ||
        /[A-Z]/.test(password),
      "Password must contain at least one uppercase letter"
    )
    .refine(
      (password) =>
        !AUTH_CONFIG.passwordRequirements.requireNumbers || /\d/.test(password),
      "Password must contain at least one number"
    )
    .refine(
      (password) =>
        !AUTH_CONFIG.passwordRequirements.requireSymbols ||
        /[^A-Za-z0-9]/.test(password),
      "Password must contain at least one symbol"
    ),
});

export type AuthSchema = z.infer<typeof authSchema>;

export const validatePassword = (password: string) => {
  const result = authSchema.shape.password.safeParse(password);
  return {
    isValid: result.success,
    error: !result.success ? result.error.issues[0]?.message : undefined,
  };
};

export const validateEmail = (email: string) => {
  const result = authSchema.shape.email.safeParse(email);
  return {
    isValid: result.success,
    error: !result.success ? result.error.issues[0]?.message : undefined,
  };
};

export const validateFormData = (
  data: any
): {
  error: string | null;
  data: AuthSchema | null;
} => {
  const result = authSchema.safeParse(data);

  if (!result.success) {
    const error = result.error.issues[0]?.message || "Invalid input";
    return { error, data: null };
  }

  return { error: null, data: result.data };
};

export const userFields = {
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot be longer than 50 characters"),
  email: authSchema.shape.email,
  // Add any other user fields here
} as const;

export const profileSchema = z.object(userFields);

export const profileUpdateSchema = z.object({
  data: z.object(userFields).partial(),
});

export type ProfileSchema = z.infer<typeof profileSchema>;
export type ProfileUpdateSchema = z.infer<typeof profileUpdateSchema>;

export const emailChangeSchema = z.object({
  newEmail: authSchema.shape.email,
});

export type EmailChangeSchema = z.infer<typeof emailChangeSchema>;

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: authSchema.shape.password,
});

export type PasswordChangeSchema = z.infer<typeof passwordChangeSchema>;

export const twoFactorVerificationSchema = z.object({
  factorId: z.string().min(1, "Factor ID is required"),
  method: z.enum(["authenticator", "sms"] as const),
  code: z
    .string()
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must contain only numbers"),
  newPassword: z.string().optional(),
});

export type TwoFactorVerificationSchema = z.infer<
  typeof twoFactorVerificationSchema
>;

export const validateTwoFactorCode = (code: string) => {
  const result = twoFactorVerificationSchema.shape.code.safeParse(code);
  return {
    isValid: result.success,
    error: !result.success ? result.error.issues[0]?.message : undefined,
  };
};

export const disable2FASchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("method"),
    factorId: z.string().min(1, "Factor ID is required"),
    method: z.enum(["authenticator", "sms"] as const),
    code: z
      .string()
      .min(6, "Code must be 6 digits")
      .max(6, "Code must be 6 digits")
      .regex(/^\d+$/, "Code must contain only numbers"),
    password: z.string().optional(),
  }),
  z.object({
    type: z.literal("all"),
    password: z.string().optional(),
    code: z
      .string()
      .min(6, "Code must be 6 digits")
      .max(6, "Code must be 6 digits")
      .regex(/^\d+$/, "Code must contain only numbers"),
    factorId: z.string().min(1, "Factor ID is required"),
  }),
]);

export type Disable2FASchema = z.infer<typeof disable2FASchema>;

// Phone number validation for SMS 2FA
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(
    /^\+[1-9]\d{1,14}$/,
    "Phone number must be in E.164 format (e.g., +1234567890)"
  );

// SMS enrollment validation
export const smsEnrollmentSchema = z.object({
  method: z.literal("sms"),
  phone: phoneSchema,
});

export type SMSEnrollmentSchema = z.infer<typeof smsEnrollmentSchema>;

export const validatePhoneNumber = (phone: string) => {
  const result = phoneSchema.safeParse(phone);
  return {
    isValid: result.success,
    error: !result.success ? result.error.issues[0]?.message : undefined,
  };
};

// Add new helper function for password requirements
export const getPasswordRequirements = (password: string) => {
  return {
    minLength: password.length >= AUTH_CONFIG.passwordRequirements.minLength,
    maxLength: password.length <= AUTH_CONFIG.passwordRequirements.maxLength,
    hasLowercase:
      !AUTH_CONFIG.passwordRequirements.requireLowercase ||
      /[a-z]/.test(password),
    hasUppercase:
      !AUTH_CONFIG.passwordRequirements.requireUppercase ||
      /[A-Z]/.test(password),
    hasNumber:
      !AUTH_CONFIG.passwordRequirements.requireNumbers || /\d/.test(password),
    hasSymbol:
      !AUTH_CONFIG.passwordRequirements.requireSymbols ||
      /[^A-Za-z0-9]/.test(password),
  };
};
