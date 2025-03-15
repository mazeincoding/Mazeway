"use client";
import useSWR from "swr";
import type { TUserWithAuth } from "@/types/auth";

export function useUser() {
  const { data, error, mutate } = useSWR<{ user: TUserWithAuth }>("/api/auth/user");

  return {
    user: data?.user,
    isLoading: !error && !data,
    error,
    refresh: mutate,
  };
}
