import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TAccountEvent } from "@/types/auth";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCw } from "lucide-react";

// Event type colors - we'll keep these in the component for now
const EVENT_COLORS = {
  "2FA_ENABLED": "text-emerald-500 dark:text-emerald-400",
  "2FA_DISABLED": "text-red-500 dark:text-red-400",
  BACKUP_CODES_GENERATED: "text-blue-500 dark:text-blue-400",
  BACKUP_CODE_USED: "text-yellow-500 dark:text-yellow-400",
  PASSWORD_CHANGED: "text-purple-500 dark:text-purple-400",
  EMAIL_CHANGED: "text-orange-500 dark:text-orange-400",
  NEW_DEVICE_LOGIN: "text-cyan-500 dark:text-cyan-400",
  DEVICE_VERIFIED: "text-teal-500 dark:text-teal-400",
  DEVICE_TRUSTED_AUTO: "text-green-500 dark:text-green-400",
  DEVICE_REVOKED: "text-rose-500 dark:text-rose-400",
  SENSITIVE_ACTION_VERIFIED: "text-indigo-500 dark:text-indigo-400",
  ACCOUNT_CREATED: "text-lime-500 dark:text-lime-400",
  ACCOUNT_DELETED: "text-red-500 dark:text-red-400",
  PROFILE_UPDATED: "text-amber-500 dark:text-amber-400",
} as const;

type TEventLogProps = {
  className?: string;
  limit?: number;
};

export function EventLog({ className, limit = 50 }: TEventLogProps) {
  const [events, setEvents] = useState<TAccountEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchEvents = async (cursorValue?: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("limit", String(limit));
      if (cursorValue) params.append("cursor", cursorValue);

      const data = await api.user.getEvents(params);

      setEvents((prev) =>
        cursorValue ? [...prev, ...data.events] : data.events
      );
      setHasMore(data.hasMore);
      if (data.events.length > 0) {
        setCursor(data.events[data.events.length - 1].created_at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchEvents();
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const formatEventMessage = (event: TAccountEvent) => {
    const metadata = event.metadata as Record<string, any>;

    switch (event.event_type) {
      case "2FA_ENABLED":
        return `(${metadata.method})`;
      case "EMAIL_CHANGED":
        return `(${metadata.old_email} → ${metadata.new_email})`;
      case "NEW_DEVICE_LOGIN":
        return `(${metadata.device_info})`;
      case "BACKUP_CODES_GENERATED":
        return `(${metadata.count} codes)`;
      case "PROFILE_UPDATED":
        return `(${metadata.updated_fields.join(", ")})`;
      default:
        return metadata && Object.keys(metadata).length > 0
          ? `(${JSON.stringify(metadata)})`
          : "";
    }
  };

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Error loading events: {error}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-end px-6 py-2 border-b">
        <button
          onClick={refresh}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      <div className="px-6 py-4">
        <div className="font-mono text-sm space-y-3">
          {events.map((event, i) => (
            <div
              key={event.id}
              className={cn(
                "flex items-start space-x-2 py-2",
                i !== 0 && "border-t border-border/50"
              )}
            >
              <span className="text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(event.created_at), {
                  addSuffix: true,
                })}
              </span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span
                className={cn(
                  "font-medium whitespace-nowrap",
                  EVENT_COLORS[event.event_type as keyof typeof EVENT_COLORS] ||
                    "text-foreground"
                )}
              >
                {event.event_type}
              </span>
              <span className="text-muted-foreground">
                {formatEventMessage(event)}
              </span>
            </div>
          ))}

          {loading && events.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && hasMore && (
            <button
              onClick={() => fetchEvents(cursor!)}
              className="w-full text-center py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-t"
            >
              Load more
            </button>
          )}

          {!loading && events.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No events found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
