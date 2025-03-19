import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TAccountEvent, TEventCategory } from "@/types/auth";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";
import { RotateCw, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type TEventLogProps = {
  className?: string;
  limit?: number;
};

const EVENT_COLORS: Record<TEventCategory, { bg: string; text: string }> = {
  success: { bg: "#22c55e", text: "#15803d" },
  error: { bg: "#ef4444", text: "#b91c1c" },
  warning: { bg: "#eab308", text: "#a16207" },
  info: { bg: "#3b82f6", text: "#1d4ed8" },
};

const getEventCategory = (event: TAccountEvent): TEventCategory => {
  if (event.metadata.error) return "error";

  // Default categories for different event types
  switch (event.event_type) {
    case "2FA_ENABLED":
    case "BACKUP_CODES_GENERATED":
    case "DEVICE_TRUSTED":
    case "DEVICE_VERIFIED":
      return "success";
    case "2FA_DISABLED":
    case "DEVICE_REVOKED":
    case "ACCOUNT_DELETED":
      return "warning";
    case "NEW_DEVICE_LOGIN":
    case "SENSITIVE_ACTION_VERIFIED":
      return "info";
    default:
      return event.metadata.category || "info";
  }
};

const formatEventMessage = (event: TAccountEvent) => {
  const metadata = event.metadata as Record<string, any>;

  // Handle device info first if present
  if (metadata.device?.browser && metadata.device?.os) {
    return `${metadata.device.browser} on ${metadata.device.os}`;
  }

  if (metadata.error) {
    return `Error: ${metadata.error}`;
  }

  switch (event.event_type) {
    case "2FA_ENABLED":
      return `Method: ${metadata.method}`;
    case "EMAIL_CHANGED":
      return `Changed from ${metadata.old_email} to ${metadata.new_email}`;
    case "NEW_DEVICE_LOGIN":
    case "DEVICE_VERIFIED":
    case "DEVICE_TRUSTED":
    case "DEVICE_TRUSTED_AUTO":
    case "DEVICE_REVOKED":
    case "DATA_EXPORT_REQUESTED":
      return metadata.device
        ? `Device: ${metadata.device.browser || "Unknown browser"} on ${metadata.device.os || "Unknown OS"}`
        : "";
    case "BACKUP_CODES_GENERATED":
      return `Generated ${metadata.count} backup codes`;
    case "PROFILE_UPDATED":
      return `Updated fields: ${metadata.fields?.join(", ")}`;
    default:
      return "";
  }
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

  if (error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center p-6 text-sm text-destructive">
          Error loading events: {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <p className="text-sm text-muted-foreground">
            {events.length} {events.length === 1 ? "event" : "events"}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
        <ScrollArea className="h-[300px] md:h-[450px] relative">
          <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
          <div className="space-y-4 p-6">
            {loading && events.length === 0 ? (
              <>
                <EventSkeleton />
                <EventSkeleton />
                <EventSkeleton />
              </>
            ) : (
              <>
                {events.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
                {loading && <EventSkeleton />}
              </>
            )}

            {!loading && events.length === 0 && (
              <p className="text-center py-4 text-muted-foreground">
                No events found
              </p>
            )}

            {!loading && hasMore && (
              <Button
                variant="outline"
                onClick={() => fetchEvents(cursor!)}
                className="w-full"
              >
                Load more
              </Button>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function EventItem({ event }: { event: TAccountEvent }) {
  const category = event.metadata.category || getEventCategory(event);
  const colors = EVENT_COLORS[category];

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className="break-all"
              style={{
                backgroundColor: `${colors.bg}20`,
                color: colors.text,
              }}
            >
              {event.event_type}
            </Badge>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 hidden sm:block" />
            <span className="text-xs text-muted-foreground capitalize">
              {category}
            </span>
          </div>
          {event.metadata.description && (
            <p className="text-sm break-words">{event.metadata.description}</p>
          )}
          {formatEventMessage(event) && (
            <p className="text-sm text-muted-foreground break-words">
              {formatEventMessage(event)}
            </p>
          )}
        </div>
        <time className="text-xs text-muted-foreground mt-1 sm:mt-0 shrink-0">
          {formatDistanceToNow(new Date(event.created_at), {
            addSuffix: true,
          })}
        </time>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-4 w-16 mt-1 sm:mt-0" />
      </div>
    </div>
  );
}
