"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/utils/validation/auth-validation";
import { z } from "zod";

type AuthResponse = {
  error?: string;
};

type ValidFormData = z.infer<typeof authSchema>;

function validateFormData(formData: FormData): {
  error: string | null;
  data: ValidFormData | null;
} {
  const data = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = authSchema.safeParse(data);

  if (!result.success) {
    const error = result.error.issues[0]?.message || "Invalid input";
    return { error, data: null };
  }

  return { error: null, data: result.data };
}

export async function login(formData: FormData): Promise<AuthResponse> {
  const validation = validateFormData(formData);
  if (validation.error || !validation.data)
    return { error: validation.error || "Invalid input" };

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword(
    validation.data
  );

  if (authError) {
    return { error: authError.message };
  }

  redirect(`/api/auth/callback?provider=email&next=/`);
}

export async function signup(formData: FormData): Promise<AuthResponse> {
  const validation = validateFormData(formData);
  if (validation.error || !validation.data)
    return { error: validation.error || "Invalid input" };

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.signUp(
    validation.data
  );

  // Debug log
  console.log("Signup response:", { data, error: authError });

  // Check for existing user
  if (data?.user?.identities?.length === 0) {
    return {
      error: "This email is already registered. Please try logging in instead.",
    };
  }

  if (authError) {
    return { error: authError.message };
  }

  return {};
}

export async function resendConfirmation(email: string): Promise<AuthResponse> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
