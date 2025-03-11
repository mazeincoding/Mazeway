// Authentication Assurance Level type
export type TAAL = "aal1" | "aal2";

// Social providers supported by the app
export type TSocialProvider = "google" | "github";

// Providers that can create a device session
export type TDeviceSessionProvider = "browser" | "email" | TSocialProvider;

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
  isNewUser?: boolean; // Indicates if this is a first-time signup
}

// Base verification methods
export type TVerificationMethod =
  | "authenticator"
  | "sms"
  | "password"
  | "email"
  | "backup_codes";

// Two-factor methods are a subset of verification methods
export type TTwoFactorMethod = Extract<
  TVerificationMethod,
  "authenticator" | "sms" | "backup_codes"
>;

export type TVerificationFactor = {
  type: TVerificationMethod;
  factorId: string;
};

export interface TDeviceSession {
  id: string;
  user_id: string;
  device_id: string;
  device: TDeviceInfo;
  is_trusted: boolean;
  needs_verification: boolean;
  confidence_score: number;
  // When this device was verified via email code (for unknown device login)
  device_verified_at: Date | null;
  // When user last performed 2FA/basic verification for sensitive actions
  last_sensitive_verification_at: Date | null;
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
    enabled2faMethods: TTwoFactorMethod[];
    availableVerificationMethods: TVerificationMethod[];
  };
}
