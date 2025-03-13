// Authentication Assurance Level type
export type TAAL = "aal1" | "aal2";

// Only the providers we actually support
export type TDeviceSessionProvider = "browser" | "google" | "github" | "email";

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
    identities?: {
      id: string;
      provider: string;
      identity_data: Record<string, any>;
      provider_id: string;
      user_id: string;
      created_at: string;
      last_sign_in_at: string;
      updated_at: string;
    }[];
  };
}

// Account event types
export type TEventType =
  // Security events
  | "2FA_ENABLED"
  | "2FA_DISABLED"
  | "BACKUP_CODES_GENERATED"
  | "BACKUP_CODE_USED"
  | "PASSWORD_CHANGED"
  | "EMAIL_CHANGED"
  // Device events
  | "NEW_DEVICE_LOGIN"
  | "DEVICE_VERIFIED"
  | "DEVICE_TRUSTED"
  | "DEVICE_REVOKED"
  | "SENSITIVE_ACTION_VERIFIED"
  // Account events
  | "ACCOUNT_CREATED"
  | "ACCOUNT_DELETED"
  | "PROFILE_UPDATED";

// Base device info that's included in device-related events
export type TEventDeviceInfo = {
  device_name: string;
  browser?: string | null;
  os?: string | null;
  ip_address?: string;
};

// Metadata for different event types
export type TEventMetadata = {
  // Security events
  "2FA_ENABLED": {
    method: TTwoFactorMethod;
  };
  "2FA_DISABLED": {
    method: TTwoFactorMethod;
  };
  BACKUP_CODES_GENERATED: {
    count: number;
  };
  BACKUP_CODE_USED: {
    device?: TEventDeviceInfo;
  };
  PASSWORD_CHANGED: {
    device?: TEventDeviceInfo;
  };
  EMAIL_CHANGED: {
    oldEmail: string;
    newEmail: string;
    device?: TEventDeviceInfo;
  };
  // Device events
  NEW_DEVICE_LOGIN: {
    device: TEventDeviceInfo;
  };
  DEVICE_VERIFIED: {
    device: TEventDeviceInfo;
  };
  DEVICE_TRUSTED: {
    device: TEventDeviceInfo;
  };
  DEVICE_REVOKED: {
    device: TEventDeviceInfo;
  };
  SENSITIVE_ACTION_VERIFIED: {
    device: TEventDeviceInfo;
    action: string;
  };
  // Account events
  ACCOUNT_CREATED: {
    device: TEventDeviceInfo;
  };
  ACCOUNT_DELETED: {
    device: TEventDeviceInfo;
  };
  PROFILE_UPDATED: {
    fields: string[];
  };
};

// The actual event record
export type TAccountEvent = {
  id: string;
  user_id: string;
  device_session_id?: string;
  event_type: TEventType;
  metadata: TEventMetadata[TEventType];
  created_at: string;
};
