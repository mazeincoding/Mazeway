"use client";

/**
 * Why not SWR? Most hooks here use SWR, but we need to:
 * - Keep track of previously loaded events when paginating
 * - Show different loading states for "first load" vs "load more"
 * - Track a cursor for pagination + total count
 *
 * Could use useSWRInfinite but it'd be overkill.
 */
import { useState, useCallback, useEffect } from "react";
import type { TAccountEvent } from "@/types/auth";
import { api } from "@/utils/api";

export function useAccountEvents(limit = 20) {
  const [events, setEvents] = useState<TAccountEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [totalEvents, setTotalEvents] = useState<number>(0);

  const fetchEvents = useCallback(
    async (cursorValue?: string) => {
      try {
        if (cursorValue) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const params = new URLSearchParams();
        params.append("limit", String(limit));
        if (cursorValue) params.append("cursor", cursorValue);

        const data = await api.user.getEvents(params);

        setEvents((prev) =>
          cursorValue ? [...prev, ...data.events] : data.events
        );
        setHasMore(data.hasMore);
        if (!cursorValue) {
          setTotalEvents(data.total);
        }
        if (data.events.length > 0) {
          setCursor(data.events[data.events.length - 1].created_at);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit]
  );

  const refresh = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  const loadMore = useCallback(() => {
    if (cursor) {
      fetchEvents(cursor);
    }
  }, [cursor, fetchEvents]);

  // Trigger initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    loadingMore,
    error,
    hasMore,
    totalEvents,
    refresh,
    loadMore,
  };
}
