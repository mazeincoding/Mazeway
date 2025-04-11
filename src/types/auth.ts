// Authentication Assurance Level type
export type TAAL = "aal1" | "aal2";

export type TSocialProvider = "google" | "github";

// Only the providers we actually support
export type TDeviceSessionProvider = "email" | TSocialProvider;

export interface TDeviceInfo {
  user_id: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  ip_address?: string;
}

export interface TDeviceTrust {
  score: number;
  level: "high" | "medium" | "low";
  needsVerification: boolean;
  isTrusted: boolean;
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
  friendly_name?: string;
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
  has_backup_codes: boolean;
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
  // Social provider events
  | "SOCIAL_PROVIDER_CONNECTED"
  | "SOCIAL_PROVIDER_DISCONNECTED"
  // Device events
  | "NEW_DEVICE_LOGIN"
  | "DEVICE_VERIFIED"
  | "DEVICE_TRUSTED"
  | "DEVICE_TRUSTED_AUTO"
  | "DEVICE_REVOKED"
  | "DEVICE_REVOKED_ALL"
  | "SENSITIVE_ACTION_VERIFIED"
  // Account events
  | "ACCOUNT_CREATED"
  | "ACCOUNT_DELETED"
  | "PROFILE_UPDATED"
  | "DATA_EXPORT_REQUESTED";

// Device info in event context (without user_id since that's in the event record)
export type TEventDeviceInfo = Omit<TDeviceInfo, "user_id">;

// Event category types
export type TEventCategory = "success" | "error" | "warning" | "info";

// Base type for event metadata that includes error info and category
type TBaseEventMetadata = {
  error?: string;
  category: TEventCategory;
  description: string;
};

// Metadata for different event types
export type TEventMetadata = {
  // Security events
  "2FA_ENABLED": TBaseEventMetadata & {
    method: TTwoFactorMethod;
  };
  "2FA_DISABLED": TBaseEventMetadata & {
    method: TTwoFactorMethod;
  };
  BACKUP_CODES_GENERATED: TBaseEventMetadata & {
    count: number;
  };
  BACKUP_CODE_USED: TBaseEventMetadata & {
    device?: TEventDeviceInfo;
  };
  PASSWORD_CHANGED: TBaseEventMetadata & {
    device?: TEventDeviceInfo;
  };
  EMAIL_CHANGED: TBaseEventMetadata & {
    oldEmail: string;
    newEmail: string;
    device?: TEventDeviceInfo;
  };
  // Device events
  NEW_DEVICE_LOGIN: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  DEVICE_VERIFIED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  DEVICE_TRUSTED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  DEVICE_TRUSTED_AUTO: TBaseEventMetadata & {
    device: TEventDeviceInfo;
    reason: "new_account" | "oauth";
  };
  DEVICE_REVOKED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  DEVICE_REVOKED_ALL: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  SENSITIVE_ACTION_VERIFIED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
    action: string;
  };
  // Account events
  ACCOUNT_CREATED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  ACCOUNT_DELETED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  PROFILE_UPDATED: TBaseEventMetadata & {
    fields: string[];
  };
  DATA_EXPORT_REQUESTED: TBaseEventMetadata & {
    device: TEventDeviceInfo;
  };
  // Social provider events
  SOCIAL_PROVIDER_CONNECTED: TBaseEventMetadata & {
    provider: TSocialProvider;
  };
  SOCIAL_PROVIDER_DISCONNECTED: TBaseEventMetadata & {
    provider: TSocialProvider;
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

// Data export status types
export type TDataExportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

// Data export event payload type
export interface TDataExportEventPayload {
  userId: string;
  exportId: string;
  token: string;
}

// Data export request type
export interface TDataExportRequest {
  id: string;
  user_id: string;
  status: TDataExportStatus;
  token_hash: string;
  salt: string;
  token_used?: boolean;
  error?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}
