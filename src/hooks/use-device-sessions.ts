import { useEffect, useState } from "react";
import { TDeviceSession } from "@/types/auth";

export function useDeviceSessions() {
  const [sessions, setSessions] = useState<TDeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/auth/device-sessions");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch device sessions");
      }

      setSessions(data.data);
    } catch (err) {
      console.error("Error fetching device sessions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return {
    sessions,
    isLoading,
    error,
    refresh: fetchSessions,
  };
}
