import {
  TDeviceInfo,
  TDeviceSession,
  TTwoFactorMethod,
  TUserWithAuth,
  TwoFactorRequirement,
} from "./auth";

// ===== REQUEST TYPES =====

// /api/auth/device-sessions
export interface TCreateDeviceSessionRequest {
  user_id: string;
  session_id: string;
  device: TDeviceInfo;
  confidence_score: number;
  needs_verification: boolean;
  is_trusted: boolean;
}

// /api/auth/create-user
export interface TCreateUserRequest {
  id: string;
  email: string;
}

// /api/auth/2fa/disable
export interface TDisable2FARequest {
  factorId: string;
  method: TTwoFactorMethod;
  code: string;
  password?: string;
}

// /api/auth/2fa/enroll
export interface TEnroll2FARequest {
  method: TTwoFactorMethod;
  password: string;
  phone?: string; // Only required for SMS method
}

// /api/auth/change-email
export interface TChangeEmailRequest {
  newEmail: string;
}

// /api/auth/verify-password
export interface TVerifyPasswordRequest {
  password: string;
}

// ===== RESPONSE TYPES =====

// Shared response type for error cases
export interface TApiErrorResponse {
  error: string;
}

// /api/auth/device-sessions
export interface TGetDeviceSessionsResponse {
  data: TDeviceSession[];
}

// /api/auth/device-sessions/trusted
export interface TGetTrustedDeviceSessionsResponse {
  data: TDeviceSession[];
}

// /api/auth/2fa/enroll
export interface TEnroll2FAResponse {
  factor_id: string;
  // For authenticator method only
  qr_code?: string;
  secret?: string;
  // For SMS method only
  phone?: string; // Masked phone number for display
}

// /api/auth/2fa/verify
export interface TVerify2FAResponse {
  success: boolean;
}

// /api/auth/email/login
export interface TEmailLoginResponse extends TwoFactorRequirement {
  redirectTo: string;
}

// /api/auth/reset-password
export interface TResetPasswordResponse extends TwoFactorRequirement {
  newPassword?: string;
}

// /api/auth/change-password
export interface TPasswordChangeResponse extends TwoFactorRequirement {
  newPassword?: string;
}

// /api/auth/change-email
export interface TChangeEmailResponse extends TwoFactorRequirement {
  newEmail?: string;
}

// /api/auth/device-sessions/[id]
export interface TRevokeDeviceSessionResponse extends TwoFactorRequirement {
  sessionId: string;
}

// /api/user
export interface TGetUserResponse {
  user: TUserWithAuth;
}

// /api/auth/device-sessions/geolocation
export interface TGeolocationResponse {
  data: {
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

// Generic success response
export interface TEmptySuccessResponse {}

export type TGetDeviceSessionResponse = {
  data: TDeviceSession;
};
