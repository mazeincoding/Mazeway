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
      `[Geolocation] Fetching data from ip-api.com for IP: ${targetIp}`
    );

    // Using ip-api.com with JSON format and fields we need
    const response = await fetch(
      `http://ip-api.com/json/${targetIp}?fields=status,message,city,regionName,country,lat,lon`,
      {
        // Adding timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("[Geolocation] ip-api.com response:", {
      status: response.status,
      data,
      targetIp,
      timestamp: requestTimestamp,
    });

    if (data.status === "fail") {
      console.error("[Geolocation] ip-api.com error:", {
        error: data,
        targetIp,
        timestamp: requestTimestamp,
      });
      throw new Error(data.message || "Failed to get location data");
    }

    return NextResponse.json({
      data: {
        city: data.city,
        region: data.regionName,
        country: data.country,
        latitude: data.lat,
        longitude: data.lon,
      },
    }) satisfies NextResponse<TGeolocationResponse>;
  } catch (error) {
    // Check specifically for timeout errors
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("[Geolocation] Request timeout:", {
        targetIp,
        timestamp: requestTimestamp,
      });
      return NextResponse.json(
        { error: "Location service timed out. Please try again." },
        { status: 408 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

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
