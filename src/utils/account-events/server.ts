import { createClient } from "@/utils/supabase/server";
import { TEventType, TEventMetadata } from "@/types/auth";

type TLogEventOptions<T extends TEventType> = {
  user_id: string;
  event_type: T;
  metadata: TEventMetadata[T];
  device_session_id?: string;
};

/**
 * Logs an account event to the database. Server-side only.
 * @param options Event details including type and metadata
 */
export async function logAccountEvent<T extends TEventType>(
  options: TLogEventOptions<T>
) {
  console.log(
    `[Account Event] Logging event type: ${options.event_type} for user: ${options.user_id}`
  );

  if (typeof window !== "undefined") {
    console.error("[Account Event] Attempted to log event from client side");
    throw new Error("Logging account events can only be done on the server");
  }

  try {
    console.log("[Account Event] Creating admin client for event logging");
    const adminClient = await createClient({ useServiceRole: true });

    console.log("[Account Event] Inserting event into database", {
      event_type: options.event_type,
      device_session_id: options.device_session_id || "none",
      metadata_keys: Object.keys(options.metadata),
    });

    const { data: event, error } = await adminClient
      .from("account_events")
      .insert({
        user_id: options.user_id,
        device_session_id: options.device_session_id,
        event_type: options.event_type,
        metadata: options.metadata,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Account Event] Failed to log event:", {
        type: options.event_type,
        error_message: error.message,
        error_code: error.code,
        details: error.details,
      });
      throw error;
    }

    console.log(
      `[Account Event] Successfully logged event with ID: ${event.id}`
    );
    return event.id;
  } catch (error) {
    console.error("[Account Event] Unexpected error while logging event:", {
      event_type: options.event_type,
      error,
    });
    throw error;
  }
}
