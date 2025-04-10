import useSWR from "swr";
import type { TGetDeviceSessionsResponse } from "@/types/api";
import { api } from "@/utils/api";

export function useDeviceSessions() {
  const { data, error, isLoading, mutate } = useSWR<TGetDeviceSessionsResponse>(
    "/api/auth/device-sessions",
    async () => {
      return api.auth.device.getSessions();
    }
  );

  return {
    deviceSessions: data?.data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
