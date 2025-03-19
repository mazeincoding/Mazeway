import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TGeolocationResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { isLocalIP } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const requestTimestamp = new Date().toISOString();
  const requestIp = getClientIp(request);
  const targetIp = request.nextUrl.searchParams.get("ip");

  console.log(
    `[Geolocation] Request at ${requestTimestamp} - Target IP: ${targetIp}, Request IP: ${requestIp}`
  );

  if (!targetIp) {
    console.log("[Geolocation] Missing target IP parameter");
    return NextResponse.json(
      { error: "Target IP address is required" },
      { status: 400 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }

  if (isLocalIP(targetIp)) {
    console.log("[Geolocation] Local IP detected, returning mock data");
    return NextResponse.json({
      data: {
        city: "Local Development",
        region: undefined,
        country: undefined,
      },
    }) satisfies NextResponse<TGeolocationResponse>;
  }

  if (apiRateLimit) {
    const { success } = await apiRateLimit.limit(requestIp);

    if (!success) {
      console.log(
        `[Geolocation] Rate limit exceeded for request IP: ${requestIp}`
      );
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  }

  try {
    console.log(
      `[Geolocation] Fetching data from ipapi.co for IP: ${targetIp}`
    );
    const response = await fetch(`https://ipapi.co/${targetIp}/json/`);
    const data = await response.json();

    // Log the raw response for debugging
    console.log("[Geolocation] ipapi.co response:", {
      status: response.status,
      data: data,
      targetIp,
      timestamp: requestTimestamp,
    });

    if (data.error && data.reason?.toLowerCase().includes("rate limit")) {
      console.log("[Geolocation] ipapi.co rate limit hit:", data);
      return NextResponse.json(
        {
          error:
            "Location service is temporarily unavailable. Please try again later.",
        },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    if (data.error) {
      console.error("[Geolocation] ipapi.co error:", {
        error: data,
        targetIp,
        timestamp: requestTimestamp,
      });
      throw new Error(data.reason || "Failed to get location data");
    }

    return NextResponse.json({
      data: {
        city: data.city,
        region: data.region,
        country: data.country_name,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    }) satisfies NextResponse<TGeolocationResponse>;
  } catch (error) {
    console.error("[Geolocation] Critical error:", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : error,
      targetIp,
      timestamp: requestTimestamp,
    });

    return NextResponse.json(
      { error: "Failed to get location data" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
