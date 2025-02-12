import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TGeolocationResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";

// List of development/local IPs that don't need geolocation
const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost"]);

export async function GET(request: NextRequest) {
  const ipAddress = getClientIp(request);
  if (apiRateLimit) {
    const { success } = await apiRateLimit.limit(ipAddress);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }
  }

  if (!ipAddress) {
    return NextResponse.json(
      { error: "IP address is required" },
      { status: 400 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }

  // Return a standard response for local IPs
  if (LOCAL_IPS.has(ipAddress)) {
    return NextResponse.json({
      data: {
        city: "Local Development",
        region: undefined,
        country: undefined,
      },
    }) satisfies NextResponse<TGeolocationResponse>;
  }

  try {
    // Use ipapi.co's free service (no API key required)
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
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
