import {
  TDeviceInfo,
  TDeviceSession,
  TTwoFactorMethod,
  TUserWithAuth,
  TVerificationMethod,
  TVerificationFactor,
  TAccountEvent,
} from "./auth";
import type { ProfileSchema } from "@/utils/validation/auth-validation";

// Shared interface for responses that might require verification
export interface TVerificationRequirement {
  requiresTwoFactor?: boolean;
  factorId?: string;
  availableMethods?: TVerificationFactor[];
}

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

// /api/auth/email/login
export interface TEmailLoginRequest {
  email: string;
  password: string;
}

// /api/auth/email/signup
export interface TEmailSignupRequest {
  email: string;
  password: string;
}

// /api/auth/email/resend-confirmation
export interface TResendConfirmationRequest {
  email: string;
}

// /api/auth/send-email-alert
export interface TSendEmailAlertRequest {
  email: string;
  title: string;
  message: string;
  device?: TDeviceInfo;
  oldEmail?: string;
  newEmail?: string;
  method?: string;
  revokedDevice?: {
    device_name: string;
    browser?: string;
    os?: string;
    ip_address?: string;
  };
}

// /api/auth/verify-device/send-code
export interface TSendDeviceVerificationRequest {
  device_session_id: string;
  device_name: string;
}

// /api/auth/verify-device
export interface TVerifyDeviceRequest {
  device_session_id: string;
  code: string;
}

// /api/auth/change-password
export interface TChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// /api/auth/reset-password
export interface TResetPasswordRequest {
  password: string;
}

// /api/auth/2fa/disable
export interface TDisable2FARequest {
  method: TTwoFactorMethod;
  code: string;
}

// /api/auth/2fa/enroll
export interface TEnroll2FARequest {
  method: TTwoFactorMethod;
  phone?: string; // Only required for SMS method
}

// /api/auth/verify
export interface TVerifyRequest {
  factorId: string;
  method: TVerificationMethod;
  code: string;
  phone?: string; // Only included for SMS verification
  email?: string; // Only included for email verification
}

// /api/auth/verify-password
export interface TVerifyPasswordRequest {
  password: string;
}

// /api/auth/change-email
export interface TChangeEmailRequest {
  newEmail: string;
}

// /api/auth/forgot-password
export interface TForgotPasswordRequest {
  email: string;
}

// /api/auth/email/check
export interface TCheckEmailRequest {
  email: string;
}

// /api/auth/user/update
export interface TUpdateUserRequest {
  data: Partial<ProfileSchema>;
}

// /api/auth/device-sessions/[id]
export interface TRevokeDeviceSessionRequest {
  sessionId: string;
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

// /api/auth/verify
export interface TVerifyResponse {
  success: boolean;
  backup_codes?: string[];
}

// /api/auth/email/login
export interface TEmailLoginResponse extends TVerificationRequirement {
  redirectTo: string;
}

// /api/auth/reset-password
export interface TResetPasswordResponse extends TVerificationRequirement {
  newPassword?: string;
}

// /api/auth/change-password
export interface TPasswordChangeResponse extends TVerificationRequirement {
  newPassword?: string;
}

// /api/auth/change-email
export interface TChangeEmailResponse extends TVerificationRequirement {
  newEmail?: string;
}

// /api/auth/device-sessions/[id]
export interface TRevokeDeviceSessionResponse extends TVerificationRequirement {
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

// /api/auth/user/delete
export interface TDeleteAccountResponse extends TVerificationRequirement {}

// /api/auth/email/check
export interface TCheckEmailResponse {
  exists: boolean;
}

// /api/auth/google/signin
export interface TGoogleSignInResponse {
  url: string;
}

// /api/auth/github/signin
export interface TGithubSignInResponse {
  url: string;
}

export type TGetDeviceSessionResponse = {
  data: TDeviceSession;
};

export type TGetEventsResponse = {
  events: TAccountEvent[];
  hasMore: boolean;
  total: number;
};

// Generic success response
export interface TEmptySuccessResponse {}
