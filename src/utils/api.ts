import type {
  TVerifyRequest,
  TVerifyResponse,
  TEnroll2FARequest,
  TEnroll2FAResponse,
  TDisable2FARequest,
  TEmailLoginRequest,
  TEmailLoginResponse,
  TEmailSignupRequest,
  TResendConfirmationRequest,
  TSendEmailAlertRequest,
  TSendDeviceVerificationRequest,
  TVerifyDeviceRequest,
  TChangePasswordRequest,
  TResetPasswordRequest,
  TCheckEmailRequest,
  TCheckEmailResponse,
  TGoogleSignInResponse,
  TGithubSignInResponse,
  TChangeEmailRequest,
  TForgotPasswordRequest,
  TPasswordChangeResponse,
  TResetPasswordResponse,
  TEmptySuccessResponse,
  TChangeEmailResponse,
  TDeleteAccountResponse,
  TGetDeviceSessionsResponse,
  TGetTrustedDeviceSessionsResponse,
  TRevokeDeviceSessionResponse,
  TGetUserResponse,
  TGetDeviceSessionResponse,
  TGeolocationResponse,
  TUpdateUserRequest,
  TRevokeDeviceSessionRequest,
  TGetEventsResponse,
  TCreateDataExportResponse,
  TGetDataExportStatusResponse,
  TGetDataExportsResponse,
  TGetUserIdentitiesResponse,
  TConnectSocialProviderResponse,
  TDisconnectSocialProviderResponse,
} from "@/types/api";
import { TSocialProvider } from "@/types/auth";
import type { ProfileSchema } from "@/validation/auth-validation";
import { mutate } from "swr";
import { createClient } from "@/utils/supabase/client";
import type { UserIdentity } from "@supabase/supabase-js";

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const api = {
  auth: {
    verify: async (params: TVerifyRequest) => {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const result = await handleResponse<TVerifyResponse>(response);

      if (result.success) {
        await mutate("/api/auth/user");
      }

      return result;
    },

    setup2FA: async (params: TEnroll2FARequest) => {
      const response = await fetch("/api/auth/2fa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TEnroll2FAResponse>(response);
    },

    disable2FA: async (params: TDisable2FARequest) => {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TEmptySuccessResponse>(response);
    },

    login: async (params: TEmailLoginRequest) => {
      const response = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (response.status === 303) {
        window.location.href = response.url;
        return null;
      }

      return handleResponse<TEmailLoginResponse>(response);
    },

    signup: async (params: TEmailSignupRequest) => {
      const response = await fetch("/api/auth/email/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      return handleResponse<TEmptySuccessResponse>(response);
    },

    resendConfirmation: async (email: string) => {
      const params: TResendConfirmationRequest = { email };
      const response = await fetch("/api/auth/email/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TEmptySuccessResponse>(response);
    },

    sendEmailAlert: async (params: TSendEmailAlertRequest) => {
      const response = await fetch("/api/auth/send-email-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TEmptySuccessResponse>(response);
    },

    verifyDevice: {
      sendCode: async (params: TSendDeviceVerificationRequest) => {
        const response = await fetch("/api/auth/verify-device/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        return handleResponse<TEmptySuccessResponse>(response);
      },
      verify: async (params: TVerifyDeviceRequest) => {
        const response = await fetch("/api/auth/verify-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        return handleResponse<TEmptySuccessResponse>(response);
      },
    },

    changePassword: async (params: TChangePasswordRequest) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TPasswordChangeResponse>(response);
    },

    resetPassword: async (params: TResetPasswordRequest) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TResetPasswordResponse>(response);
    },

    checkEmail: async (email: string) => {
      const params: TCheckEmailRequest = { email };
      const response = await fetch("/api/auth/email/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TCheckEmailResponse>(response);
    },

    logout: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return handleResponse<TEmptySuccessResponse>(response);
    },

    googleSignIn: async () => {
      const response = await fetch("/api/auth/google/signin", {
        method: "POST",
      });
      return handleResponse<TGoogleSignInResponse>(response);
    },

    githubSignIn: async () => {
      const response = await fetch("/api/auth/github/signin", {
        method: "POST",
      });
      return handleResponse<TGithubSignInResponse>(response);
    },

    changeEmail: async (params: TChangeEmailRequest) => {
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TChangeEmailResponse>(response);
    },

    forgotPassword: async (email: string) => {
      const params: TForgotPasswordRequest = { email };
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse<TEmptySuccessResponse>(response);
    },

    deleteAccount: async () => {
      const response = await fetch("/api/auth/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return handleResponse<TDeleteAccountResponse>(response);
    },

    device: {
      getSessions: async () => {
        const response = await fetch("/api/auth/device-sessions");
        return handleResponse<TGetDeviceSessionsResponse>(response);
      },

      getTrustedSessions: async () => {
        const response = await fetch("/api/auth/device-sessions/trusted");
        return handleResponse<TGetTrustedDeviceSessionsResponse>(response);
      },

      getCurrent: async () => {
        const response = await fetch("/api/auth/device-sessions/current");
        return handleResponse<TGetDeviceSessionResponse>(response);
      },

      getGeolocation: async (ipAddress: string) => {
        const response = await fetch(
          `/api/auth/device-sessions/geolocation?ip=${encodeURIComponent(ipAddress)}`
        );
        return handleResponse<TGeolocationResponse>(response);
      },

      revokeSession: async (params: TRevokeDeviceSessionRequest) => {
        const response = await fetch(
          `/api/auth/device-sessions/${params.sessionId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          }
        );
        const data = await handleResponse<
          TEmptySuccessResponse | TRevokeDeviceSessionResponse
        >(response);
        return data;
      },
    },

    sendEmailVerification: async () => {
      const response = await fetch("/api/auth/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return handleResponse<TEmptySuccessResponse>(response);
    },

    dataExport: {
      create: async () => {
        const response = await fetch("/api/auth/data-exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        return handleResponse<TCreateDataExportResponse>(response);
      },

      getAll: async () => {
        const response = await fetch("/api/auth/data-exports");
        return handleResponse<TGetDataExportsResponse>(response);
      },

      getStatus: async (exportId: string) => {
        const response = await fetch(`/api/auth/data-exports/${exportId}`);
        return handleResponse<TGetDataExportStatusResponse>(response);
      },
    },

    getUserIdentities: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data as TGetUserIdentitiesResponse;
    },

    connectSocialProvider: async (provider: TSocialProvider) => {
      const response = await fetch("/api/auth/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      return handleResponse<TConnectSocialProviderResponse>(response);
    },

    disconnectSocialProvider: async (provider: TSocialProvider) => {
      const response = await fetch("/api/auth/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      return handleResponse<TDisconnectSocialProviderResponse>(response);
    },
  },

  user: {
    get: async () => {
      const response = await fetch("/api/auth/user");
      return handleResponse<TGetUserResponse>(response);
    },

    update: async (
      data: Partial<ProfileSchema>
    ): Promise<TEmptySuccessResponse> => {
      const params: TUpdateUserRequest = { data };
      const response = await fetch("/api/auth/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const result = await handleResponse<TEmptySuccessResponse>(response);

      // Refresh user data after successful update
      await mutate("/api/auth/user");

      return result;
    },

    getEvents: async (params?: URLSearchParams) => {
      const response = await fetch(
        `/api/auth/user/events${params ? `?${params}` : ""}`
      );
      return handleResponse<TGetEventsResponse>(response);
    },
  },
};
