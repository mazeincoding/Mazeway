import {
  TDeviceInfo,
  TDeviceSession,
  TTwoFactorMethod,
  TUserWithAuth,
  TVerificationMethod,
  TVerificationFactor,
  TAccountEvent,
  TDataExportStatus,
  TDataExportRequest,
  TSocialProvider,
} from "./auth";
import type { ProfileSchema } from "@/validation/auth-validation";

// For API routes where the user already did basic verification naturally, like login
export interface TTwoFactorVerificationRequirement {
  requiresTwoFactor?: boolean;
  availableMethods?: TVerificationFactor[];
}

// For API routes where the user is:
// - Authenticated
// - Doing a sensitive action
// - That doesn't naturally require verification (like login, change password, etc)
export interface TGeneralVerificationRequirement {
  requiresVerification?: boolean;
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
  email?: string;
  title: string;
  message: string;
  device?: TDeviceInfo;
  oldEmail?: string;
  newEmail?: string;
  method?: string;
  revokedDevice?: TDeviceInfo;
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
  currentPassword?: string;
  newPassword: string;
  checkVerificationOnly?: boolean;
}

// /api/auth/reset-password
export interface TResetPasswordRequest {
  password: string;
}

// /api/auth/2fa/disable
export interface TDisable2FARequest {
  method: TTwoFactorMethod;
  checkVerificationOnly?: boolean;
}

// /api/auth/2fa/enroll
export interface TEnroll2FARequest {
  method: TTwoFactorMethod;
  phone?: string; // Only required for SMS method
  checkVerificationOnly?: boolean;
}

// /api/auth/verify
export interface TVerifyRequest {
  method: TVerificationMethod;
  code: string;
  phone?: string; // Only included for SMS verification
  email?: string; // Only included for email verification
}

// /api/auth/change-email
export interface TChangeEmailRequest {
  newEmail: string;
  checkVerificationOnly?: boolean;
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
  checkVerificationOnly?: boolean;
}

// /api/auth/device-sessions/revoke-all
export interface TRevokeAllDeviceSessionsRequest {
  checkVerificationOnly?: boolean;
}

// /api/auth/social/connect
export interface TConnectSocialProviderRequest {
  provider: TSocialProvider;
  checkVerificationOnly?: boolean;
}

// /api/auth/social/disconnect
export interface TDisconnectSocialProviderRequest {
  provider: TSocialProvider;
  checkVerificationOnly?: boolean;
}

// /api/auth/user/delete
export interface TDeleteAccountRequest {
  checkVerificationOnly?: boolean;
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
export type TEnroll2FAResponse =
  // If verification is needed
  | {
      requiresVerification: true;
      availableMethods: TVerificationFactor[];
      // We require verification, factor_id isn't needed
      // To be clear, the top-level factor_id is the factor we're enrolling
      // Not the factor ID used for verification
    }
  // If verification is completed/not needed
  | {
      requiresVerification?: false;
      // The factor_id is the method we're enabling, NOT a method for verification
      factor_id: string;
      // For authenticator method only
      qr_code?: string;
      secret?: string;
      // For SMS method only
      phone?: string;
    };

// /api/auth/verify
export interface TVerifyResponse {
  success: boolean;
  backup_codes?: string[];
}

// /api/auth/2fa/disable
export interface TDisable2FAResponse extends TGeneralVerificationRequirement {}

// /api/auth/email/login
export interface TEmailLoginResponse extends TTwoFactorVerificationRequirement {
  redirectTo: string;
}

// /api/auth/reset-password
export interface TResetPasswordResponse
  extends TTwoFactorVerificationRequirement {
  newPassword?: string;
  loginRequired?: boolean;
  redirectTo?: string;
}

// /api/auth/change-password
export interface TChangePasswordResponse
  extends TTwoFactorVerificationRequirement {
  newPassword?: string;
  requiresRelogin?: boolean;
  email?: string;
  message?: string;
}

// /api/auth/change-email
export interface TChangeEmailResponse extends TGeneralVerificationRequirement {
  newEmail?: string;
}

// /api/auth/device-sessions/[id]
export interface TRevokeDeviceSessionResponse
  extends TGeneralVerificationRequirement {
  sessionId: string;
}

// /api/auth/device-sessions/revoke-all
export interface TRevokeAllDeviceSessionsResponse
  extends TGeneralVerificationRequirement {
  revokedCount?: number;
}

// /api/auth/user
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
export interface TDeleteAccountResponse
  extends TGeneralVerificationRequirement {}

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

// /api/auth/device-sessions/[id]
export interface TGetDeviceSessionResponse {
  data: TDeviceSession;
}

// /api/auth/events
export interface TGetEventsResponse {
  events: TAccountEvent[];
  hasMore: boolean;
  total: number;
}

// /api/auth/data-exports
export interface TCreateDataExportResponse {
  id: string;
  status: TDataExportStatus;
}

export type TDataExportResponseItem = Pick<
  TDataExportRequest,
  "id" | "status" | "created_at" | "completed_at"
>;

export interface TGetDataExportsResponse {
  exports: TDataExportResponseItem[];
}

// /api/auth/data-exports/[id]
export interface TGetDataExportStatusResponse extends TDataExportResponseItem {}

// Generic success response
export interface TEmptySuccessResponse {}

// /api/auth/social/connect
export interface TConnectSocialProviderResponse
  extends TGeneralVerificationRequirement {
  url?: string;
  success?: true;
}

// /api/auth/social/disconnect
export interface TDisconnectSocialProviderResponse
  extends TGeneralVerificationRequirement {}
