import { TDeviceInfo, TDeviceSession } from "./auth";

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
  code: string;
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
  qr_code: string;
  secret: string;
  factor_id: string;
}

// /api/auth/2fa/verify
export interface TVerify2FAResponse {
  success: boolean;
}

// /api/auth/email/login
export interface TEmailLoginResponse {
  requiresTwoFactor: boolean;
  factorId?: string;
  redirectTo: string;
}

// Generic success response
export interface TEmptySuccessResponse {}
