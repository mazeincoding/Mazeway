import { z } from "zod";

export const authSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .max(255, "Email is too long")
    .email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
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

export const profileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot be longer than 50 characters"),
  email: authSchema.shape.email,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: authSchema.shape.password,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type ProfileSchema = z.infer<typeof profileSchema>;
export type PasswordChangeSchema = z.infer<typeof passwordChangeSchema>;
