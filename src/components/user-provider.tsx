"use client";

import { SWRConfig } from "swr";

export function UserProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Global configuration for all SWR hooks
        fetcher: async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            const error = await response.json();

            // If /api/auth/user returns 401, session is invalid
            if (url === "/api/auth/user" && response.status === 401) {
              // First logout to clear the session
              await fetch("/api/auth/logout", { method: "POST" });
              // Then redirect to login
              window.location.href =
                "/auth/login?message=Your session has expired. Please log in again.";
              return null;
            }

            throw new Error(error.error || "An error occurred");
          }
          return response.json();
        },
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        keepPreviousData: true,
        onError: (error) => {
          console.error("SWR Error:", error);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
