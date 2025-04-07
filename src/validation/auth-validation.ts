import { z } from "zod";
import { AUTH_CONFIG } from "@/config/auth";
import { isValidVerificationCodeFormat } from "@/utils/auth/verification-codes";
import { TTwoFactorMethod, TVerificationMethod } from "@/types/auth";

// Create a Zod enum from the TypeScript TTwoFactorMethod type
const TwoFactorMethodEnum = z.enum([
  "authenticator",
  "sms",
  "backup_codes",
] as const satisfies readonly TTwoFactorMethod[]);

// Create a Zod enum from the TVerificationMethod type
const VerificationMethodEnum = z.enum([
  "authenticator",
  "sms",
  "password",
  "email",
  "backup_codes",
] as const satisfies readonly TVerificationMethod[]);

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
  checkVerificationOnly: z.boolean().optional(),
});

export type EmailChangeSchema = z.infer<typeof emailChangeSchema>;

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: authSchema.shape.password,
  checkVerificationOnly: z.boolean().optional(),
});

export const addPasswordSchema = z.object({
  newPassword: authSchema.shape.password,
  checkVerificationOnly: z.boolean().optional(),
});

export type PasswordChangeSchema = z.infer<typeof passwordChangeSchema>;
export type AddPasswordSchema = z.infer<typeof addPasswordSchema>;

export const twoFactorVerificationSchema = z.object({
  factorId: z.string().min(1, "Factor ID is required"),
  method: TwoFactorMethodEnum,
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

export const disable2FASchema = z.object({
  method: TwoFactorMethodEnum,
  checkVerificationOnly: z.boolean().optional().default(false),
});

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
  checkVerificationOnly: z.boolean().optional(),
});

// Authenticator enrollment validation
export const authenticatorEnrollmentSchema = z.object({
  method: z.literal("authenticator"),
  checkVerificationOnly: z.boolean().optional(),
});

// Combined 2FA enrollment schema
export const twoFactorEnrollmentSchema = z.discriminatedUnion("method", [
  authenticatorEnrollmentSchema,
  smsEnrollmentSchema,
]);

export type TwoFactorEnrollmentSchema = z.infer<
  typeof twoFactorEnrollmentSchema
>;

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

// Add new general verification schema
export const verificationSchema = z
  .object({
    method: VerificationMethodEnum,
    code: z.string().min(1, "Verification code is required"),
  })
  .refine(
    (data) => {
      // For regular 2FA codes (authenticator/SMS), validate 6-digit format
      if (data.method === "authenticator" || data.method === "sms") {
        return /^\d{6}$/.test(data.code);
      }

      // For email verification, validate according to config
      if (data.method === "email") {
        return new RegExp(
          `^[A-Z0-9]{${AUTH_CONFIG.emailVerification.codeLength}}$`
        ).test(data.code);
      }

      // For password verification, validate using password schema
      if (data.method === "password") {
        const result = authSchema.shape.password.safeParse(data.code);
        return result.success;
      }

      // For backup codes, validate using the same format as enrollment
      if (data.method === "backup_codes") {
        return isValidVerificationCodeFormat({
          code: data.code,
          format: AUTH_CONFIG.backupCodes.format,
          wordCount: AUTH_CONFIG.backupCodes.wordCount,
          alphanumericLength: AUTH_CONFIG.backupCodes.alphanumericLength,
        });
      }

      return false;
    },
    {
      message: "Invalid code format",
      path: ["code"], // Show error on the code field
    }
  );

export type VerificationSchema = z.infer<typeof verificationSchema>;

// Email alert validation schema - exactly matching TSendEmailAlertRequest
export const emailAlertSchema = z.object({
  email: authSchema.shape.email,
  device: z
    .object({
      user_id: z.string(),
      device_name: z.string(),
      browser: z.string().nullable(),
      os: z.string().nullable(),
      ip_address: z.string().optional(),
    })
    .optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  oldEmail: z.string().email("Invalid email format").optional(),
  newEmail: z.string().email("Invalid email format").optional(),
  method: z.string().optional(),
});

export type EmailAlertSchema = z.infer<typeof emailAlertSchema>;

export const validateEmailAlert = (
  data: unknown
): {
  isValid: boolean;
  error?: string;
  data: EmailAlertSchema | null;
} => {
  const result = emailAlertSchema.safeParse(data);
  return {
    isValid: result.success,
    error: !result.success ? result.error.issues[0]?.message : undefined,
    data: result.success ? result.data : null,
  };
};

// Add schema for device session revocation
export const revokeDeviceSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  checkVerificationOnly: z.boolean().optional(),
});

export type RevokeDeviceSessionSchema = z.infer<
  typeof revokeDeviceSessionSchema
>;

export const dataExportTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type DataExportTokenSchema = z.infer<typeof dataExportTokenSchema>;

export const validateDataExportToken = (token: string) => {
  const result = dataExportTokenSchema.shape.token.safeParse(token);
  return {
    isValid: result.success,
    error: result.success ? null : result.error.errors[0].message,
  };
};

// Social provider validation schemas
export const socialProviderSchema = z.object({
  provider: z.enum(["google", "github"] as const),
  checkVerificationOnly: z.boolean().optional(),
});

export type SocialProviderSchema = z.infer<typeof socialProviderSchema>;

export const validateSocialProvider = (provider: unknown) => {
  const result = socialProviderSchema.shape.provider.safeParse(provider);
  return {
    isValid: result.success,
    error: !result.success ? result.error.issues[0]?.message : undefined,
  };
};

// Reset password schema
export const resetPasswordSchema = z
  .object({
    password: authSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
