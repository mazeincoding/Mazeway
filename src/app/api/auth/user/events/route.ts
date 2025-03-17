import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TApiErrorResponse, TGetEventsResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { getUser } from "@/utils/auth";
import { TEventType } from "@/types/auth";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    if (apiRateLimit) {
      const ip = getClientIp(request);
      const { success } = await apiRateLimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    const supabase = await createClient();
    const { user, error } = await getUser({ supabase });
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor"); // For pagination
    const limit = Math.min(
      parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE)),
      MAX_PAGE_SIZE
    );
    const types = searchParams.getAll("type") as TEventType[]; // Filter by event types
    const from = searchParams.get("from"); // From date
    const to = searchParams.get("to"); // To date

    // Build query
    let query = supabase
      .from("account_events")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Apply filters if provided
    if (types.length > 0) {
      query = query.in("event_type", types);
    }
    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }
    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    // Get one more than requested to check if there are more pages
    const {
      data: events,
      error: fetchError,
      count,
    } = await query.limit(limit + 1);

    if (fetchError) {
      console.error("Failed to fetch events:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Check if there are more pages
    const hasMore = events ? events.length > limit : false;
    // Remove the extra item we fetched
    if (hasMore && events) {
      events.pop();
    }

    return NextResponse.json({
      events,
      hasMore,
      total: count || 0,
    }) satisfies NextResponse<TGetEventsResponse>;
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
