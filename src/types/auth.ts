export interface TDeviceInfo {
  device_name: string;
  browser: string | null;
  os: string | null;
  ip_address?: string;
}

export type TAccessLevel = "full" | "verified" | "restricted";

export type TVerificationLevel = "none" | "light" | "full";

export interface TSecurityContext {
  accessLevel: TAccessLevel;
  verificationLevel: TVerificationLevel;
  confidenceScore: number;
  needsVerification: boolean;
  lastVerified?: Date;
}

export interface TDeviceSession {
  id: string;
  user_id: string;
  session_id: string;
  device: TDeviceInfo;
  security: TSecurityContext;
  last_active: Date;
  created_at: Date;
  updated_at: Date;
}

export type TAuthProvider = "email" | "google" | null;

export interface TUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  auth_method: TAuthProvider;
  created_at: string;
  updated_at: string;
}
