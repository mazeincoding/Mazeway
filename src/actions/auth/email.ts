"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { authSchema } from "@/utils/validation/auth-validation";
import { z } from "zod";
import { createUser } from "@/actions/auth/create-user";

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

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData): Promise<AuthResponse> {
  const validation = validateFormData(formData);
  if (validation.error || !validation.data)
    return { error: validation.error || "Invalid input" };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp(
    validation.data
  );

  if (authError) {
    return { error: authError.message };
  }

  // Create user profile after successful auth
  if (authData.user) {
    const { error: createError } = await createUser({
      id: authData.user.id,
      email: authData.user.email!,
      auth_method: "email",
    });

    if (createError) {
      return { error: createError };
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}
