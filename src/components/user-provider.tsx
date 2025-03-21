"use client";

import { SWRConfig } from "swr";

export function UserProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Global configuration for all SWR hooks
        fetcher: async (url: string) => {
          const response = await fetch(url);

          // Handle auth failures by redirecting to login
          if (response.status === 401) {
            // Try to get redirect URL from response if possible
            try {
              const data = await response.json();
              if (data.redirect) {
                console.log("Auth failed, redirecting to:", data.redirect);
                window.location.href = data.redirect;
                // Return a never-resolving promise to stop further processing
                return new Promise(() => {});
              }
            } catch (e) {
              // If we can't parse JSON, just redirect to login
              console.log("Auth failed, redirecting to login");
              window.location.href =
                "/auth/login?message=Your%20session%20has%20expired";
              // Return a never-resolving promise to stop further processing
              return new Promise(() => {});
            }
          }

          if (!response.ok) {
            try {
              const error = await response.json();
              throw new Error(error.error || "An error occurred");
            } catch (e) {
              throw new Error("An unexpected error occurred");
            }
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
