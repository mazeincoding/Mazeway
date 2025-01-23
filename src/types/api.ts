import { TDeviceInfo, TDeviceSession, TTwoFactorMethod } from "./auth";

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

// /api/auth/2fa/enroll
export interface TEnroll2FARequest {
  method: TTwoFactorMethod;
  phone?: string; // Only required for SMS method
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
export interface TEmailLoginResponse {
  requiresTwoFactor: boolean;
  factorId?: string;
  availableMethods?: Array<{
    type: TTwoFactorMethod;
    factorId: string;
  }>;
  redirectTo: string;
}

// Generic success response
export interface TEmptySuccessResponse {}
