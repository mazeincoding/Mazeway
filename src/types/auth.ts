import { TDeviceSessionProvider } from "@/utils/device-sessions/server";

export interface TDeviceInfo {
  user_id: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  ip_address?: string;
}

export interface TDeviceSessionOptions {
  trustLevel: "high" | "oauth" | "normal";
  skipVerification?: boolean;
  provider?: TDeviceSessionProvider;
}

export type TTwoFactorMethod = "authenticator" | "sms";

export interface TwoFactorRequirement {
  requiresTwoFactor: boolean;
  factorId?: string;
  availableMethods?: Array<{
    type: TTwoFactorMethod;
    factorId: string;
  }>;
}

export interface TDeviceSession {
  id: string;
  user_id: string;
  device_id: string;
  device: TDeviceInfo;
  is_trusted: boolean;
  needs_verification: boolean;
  confidence_score: number;
  last_verified: Date | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

export interface TUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface TUserWithAuth extends TUser {
  auth: {
    emailVerified: boolean;
    lastSignInAt: string;
    twoFactorEnabled: boolean;
    twoFactorMethods: TTwoFactorMethod[];
  };
}
