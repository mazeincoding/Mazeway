import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TGeolocationResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { isLocalIP } from "@/lib/utils";

export async function GET(request: NextRequest) {
  // Get request IP for rate limiting
  const requestIp = getClientIp(request);

  // Get target IP from query params
  const targetIp = request.nextUrl.searchParams.get("ip");
  if (!targetIp) {
    return NextResponse.json(
      { error: "Target IP address is required" },
      { status: 400 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }

  // Return a standard response for local IPs before rate limiting
  if (isLocalIP(targetIp)) {
    return NextResponse.json({
      data: {
        city: "Local Development",
        region: undefined,
        country: undefined,
      },
    }) satisfies NextResponse<TGeolocationResponse>;
  }

  // Only rate limit non-local IPs that will actually use the geolocation service
  if (apiRateLimit) {
    const { success } = await apiRateLimit.limit(requestIp);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  }

  try {
    // Use ipapi.co's free service (no API key required)
    const response = await fetch(`https://ipapi.co/${targetIp}/json/`);
    const data = await response.json();

    // Handle rate limiting specifically
    if (data.error && data.reason?.toLowerCase().includes("rate limit")) {
      return NextResponse.json(
        {
          error:
            "Location service is temporarily unavailable. Please try again later.",
        },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Handle other API errors
    if (data.error) {
      console.error("ipapi.co error:", data);
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
    console.error("Error getting location data:", error);
    return NextResponse.json(
      { error: "Failed to get location data" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
