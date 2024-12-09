"use server";

import { createClient } from "@/utils/supabase/server";
import { AuthProvider } from "@/types/user";

interface CreateUserData {
  id: string;
  email: string;
  auth_method: AuthProvider;
}

export async function createUser(
  userData: CreateUserData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Use email as name if name not provided
  const name = userData.email.split("@")[0];

  try {
    const { error } = await supabase.from("users").insert({
      id: userData.id,
      email: userData.email,
      name,
      avatar_url: null,
      auth_method: userData.auth_method,
    });

    if (error) throw error;

    return {};
  } catch (error) {
    console.error("Error creating user:", error);
    return { error: "Failed to create user profile" };
  }
}
