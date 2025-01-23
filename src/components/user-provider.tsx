"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/user-store";
import type { TGetUserResponse, TApiErrorResponse } from "@/types/api";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setError } = useUserStore();

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/user").catch(() => {
        setError("Failed to fetch user");
        return null;
      });

      if (!response) {
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const { error } = (await response.json()) as TApiErrorResponse;
        setError(error);
        setLoading(false);
        return;
      }

      const { user } = (await response.json()) as TGetUserResponse;
      setUser(user);
      setLoading(false);
    }

    fetchUser();
  }, [setUser, setLoading, setError]);

  // We don't show loading state or errors here since this is a root provider
  // Individual components can access isLoading/error from the store if needed
  return <>{children}</>;
}
