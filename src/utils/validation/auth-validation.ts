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
