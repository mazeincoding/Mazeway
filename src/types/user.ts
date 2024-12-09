export type AuthProvider = "email" | "google" | null;

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  auth_method: AuthProvider;
  created_at: string;
  updated_at: string;
}
