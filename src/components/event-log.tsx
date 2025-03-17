import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TAccountEvent, TEventType } from "@/types/auth";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCw } from "lucide-react";

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

    // Handle device info first if present
    if (metadata.device?.browser && metadata.device?.os) {
      return `(${metadata.device.browser} on ${metadata.device.os})`;
    }

    switch (event.event_type) {
      case "2FA_ENABLED":
        return `(${metadata.method})`;
      case "EMAIL_CHANGED":
        return `(${metadata.old_email} → ${metadata.new_email})`;
      case "NEW_DEVICE_LOGIN":
      case "DEVICE_VERIFIED":
      case "DEVICE_TRUSTED":
      case "DEVICE_TRUSTED_AUTO":
      case "DEVICE_REVOKED":
      case "DATA_EXPORT_REQUESTED":
        return "";
      case "BACKUP_CODES_GENERATED":
        return `(${metadata.count} codes)`;
      case "PROFILE_UPDATED":
        return `(${metadata.updated_fields.join(", ")})`;
      default:
        return "";
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
      <div className="flex items-center justify-end px-6 py-4 border-b">
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
              <span className="font-medium whitespace-nowrap">
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
