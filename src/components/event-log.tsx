import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TAccountEvent, TEventCategory } from "@/types/auth";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TEventLogProps = {
  className?: string;
  limit?: number;
};

const EVENT_CATEGORY_STYLES: Record<
  TEventCategory,
  { bg: string; text: string }
> = {
  success: { bg: "bg-green-500/10", text: "text-green-600" },
  error: { bg: "bg-red-500/10", text: "text-red-600" },
  warning: { bg: "bg-yellow-500/10", text: "text-yellow-600" },
  info: { bg: "bg-blue-500/10", text: "text-blue-600" },
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

  if (error) {
    return (
      <p className="text-sm text-destructive">Error loading events: {error}</p>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="flex items-center justify-between px-6 py-4 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
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
          <div className="space-y-4 p-6 pt-2">
            {events.map((event) => {
              const category =
                event.metadata.category || getEventCategory(event);
              const styles = EVENT_CATEGORY_STYLES[category];

              return (
                <Card
                  key={event.id}
                  className="overflow-hidden hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(styles.bg, styles.text)}
                            >
                              {event.event_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">
                              {category}
                            </span>
                          </div>
                          {event.metadata.description && (
                            <p className="text-sm">
                              {event.metadata.description}
                            </p>
                          )}
                          {formatEventMessage(event) && (
                            <p className="text-sm text-muted-foreground">
                              {formatEventMessage(event)}
                            </p>
                          )}
                        </div>
                        <time className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(event.created_at), {
                            addSuffix: true,
                          })}
                        </time>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {loading && events.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && hasMore && (
            <Button
              variant="outline"
              onClick={() => fetchEvents(cursor!)}
              className="w-full my-4"
            >
              Load more
            </Button>
          )}

          {!loading && events.length === 0 && (
            <p className="text-center py-4 text-muted-foreground">
              No events found
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
