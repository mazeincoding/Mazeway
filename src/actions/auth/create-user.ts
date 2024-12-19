"use server";

import { createClient } from "@/utils/supabase/server";
import { TAuthProvider } from "@/types/auth";

interface CreateUserData {
  id: string;
  email: string;
  auth_method: TAuthProvider;
}

export async function createUser(
  userData: CreateUserData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Use email as name if name not provided
  const name = userData.email.split("@")[0];

  console.log("Attempting to create user with ID:", userData.id);

  try {
    const { error } = await supabase.from("users").insert({
      id: userData.id,
      email: userData.email,
      name,
      avatar_url: null,
      auth_method: userData.auth_method,
    });

    if (error) {
      console.log("Error occurred with ID:", userData.id);
      throw error;
    }

    return {};
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { error: error.message };
  }
}
