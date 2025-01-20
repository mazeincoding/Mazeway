import { TDeviceInfo, TDeviceSession } from "./auth";

// Shared response type for error cases
export interface TApiErrorResponse {
  error: string;
}

// /api/auth/device-sessions
export interface TCreateDeviceSessionRequest {
  user_id: string;
  session_id: string;
  device: TDeviceInfo;
  confidence_score: number;
  needs_verification: boolean;
  is_trusted: boolean;
}

export interface TGetDeviceSessionsResponse {
  data: TDeviceSession[];
}

// /api/auth/device-sessions/trusted
export interface TGetTrustedDeviceSessionsResponse {
  data: TDeviceSession[];
}

// /api/auth/create-user
export interface TCreateUserRequest {
  id: string;
  email: string;
}

// Empty success responses
export interface TEmptySuccessResponse {}

// /api/auth/2fa/enroll
export interface TEnroll2FAResponse {
  qr_code: string;
  secret: string;
}
