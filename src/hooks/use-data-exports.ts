"use client";

import useSWR from "swr";
import type {
  TGetDataExportsResponse,
  TGetDataExportStatusResponse,
} from "@/types/api";
import { api } from "@/utils/api";

export function useDataExports() {
  const { data, error, isLoading, mutate } = useSWR<TGetDataExportsResponse>(
    "/api/auth/data-exports",
    async () => {
      return api.auth.dataExport.getAll();
    }
  );

  const requestExport = async () => {
    const response = await api.auth.dataExport.create();
    await mutate();
    return response;
  };

  return {
    exports: data?.exports ?? [],
    isLoading,
    error,
    refresh: mutate,
    requestExport,
  };
}

export function useDataExportStatus(exportId: string) {
  const { data, error, isLoading, mutate } =
    useSWR<TGetDataExportStatusResponse>(
      exportId ? `/api/auth/data-exports/${exportId}` : null,
      async () => {
        return api.auth.dataExport.getStatus(exportId);
      }
    );

  return {
    status: data?.status,
    createdAt: data?.created_at,
    completedAt: data?.completed_at,
    isLoading,
    error,
    refresh: mutate,
  };
}
