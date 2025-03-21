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
