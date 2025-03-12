import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TGetTrustedDeviceSessionsResponse,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { getUser } from "@/utils/auth";

/**
 * Returns all trusted device sessions for the authenticated user.
 * A session is considered trusted if it has been explicitly marked as trusted
 * during session creation based on device confidence and verification status.
 */
export async function GET(request: NextRequest) {
  console.log("[AUTH] /api/auth/device-sessions/trusted - Request received", {
    url: request.url,
    timestamp: new Date().toISOString(),
    headers: {
      cookie: !!request.headers.get("cookie"),
      useragent: request.headers.get("user-agent")?.substring(0, 50) + "...",
    },
  });

  if (apiRateLimit) {
    const ip = getClientIp(request);
    console.log(
      "[AUTH] /api/auth/device-sessions/trusted - Rate limiting check",
      {
        ip: ip,
      }
    );

    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      console.error(
        "[AUTH] /api/auth/device-sessions/trusted - Rate limit exceeded",
        {
          ip: ip,
        }
      );

      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  }

  const supabase = await createClient();

  try {
    console.log(
      "[AUTH] /api/auth/device-sessions/trusted - Getting user from auth"
    );

    const { user, error } = await getUser(supabase);

    if (error) {
      console.error("[AUTH] /api/auth/device-sessions/trusted - User error", {
        error,
      });
      throw new Error("Unauthorized");
    }

    if (!user) {
      console.error(
        "[AUTH] /api/auth/device-sessions/trusted - No user found in session"
      );
      throw new Error("Unauthorized");
    }

    console.log(
      "[AUTH] /api/auth/device-sessions/trusted - User authenticated",
      {
        userId: user.id,
        email: user.email,
      }
    );

    console.log(
      "[AUTH] /api/auth/device-sessions/trusted - Fetching trusted device sessions"
    );

    const { data, error: supabaseError } = await supabase
      .from("device_sessions")
      .select(
        `
        *,
        device:devices(*)
      `
      )
      .eq("user_id", user.id)
      .eq("is_trusted", true)
      .order("created_at", { ascending: false });

    if (supabaseError) {
      console.error(
        "[AUTH] /api/auth/device-sessions/trusted - Database error",
        {
          error: supabaseError.message,
          code: supabaseError.code,
        }
      );
      throw supabaseError;
    }

    console.log(
      "[AUTH] /api/auth/device-sessions/trusted - Sessions fetched successfully",
      {
        count: data ? data.length : 0,
      }
    );

    return NextResponse.json({
      data,
    }) satisfies NextResponse<TGetTrustedDeviceSessionsResponse>;
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching trusted device sessions:", {
      error: err.message,
      stack: err.stack,
    });

    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
