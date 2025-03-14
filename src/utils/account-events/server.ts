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
  if (typeof window !== "undefined") {
    throw new Error("Cannot log events on the client");
  }

  const adminClient = await createClient({ useServiceRole: true });

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
    console.error("Failed to log account event:", {
      type: options.event_type,
      error,
    });
    throw error;
  }

  return event.id;
}
