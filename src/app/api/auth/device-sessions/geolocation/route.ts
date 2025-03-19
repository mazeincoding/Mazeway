import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse, TGeolocationResponse } from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { isLocalIP } from "@/lib/utils";

// Timeout for geolocation requests (ms)
const REQUEST_TIMEOUT = 5000;

// Helper to format the response data consistently regardless of provider
const formatGeoResponse = (
  data: any,
  provider: string
): TGeolocationResponse => ({
  data: {
    city: data.city,
    region: provider === "ipapi" ? data.region : data.regionName,
    country: provider === "ipapi" ? data.country_name : data.country,
    latitude: provider === "ipapi" ? data.latitude : data.lat,
    longitude: provider === "ipapi" ? data.longitude : data.lon,
  },
});

async function getIpApiLocation(
  targetIp: string
): Promise<TGeolocationResponse> {
  const response = await fetch(
    `http://ip-api.com/json/${targetIp}?fields=status,message,city,regionName,country,lat,lon`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT) }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (data.status === "fail") {
    throw new Error(data.message || "ip-api.com failed to get location data");
  }

  return formatGeoResponse(data, "ipapi.com");
}

async function getIpapiLocation(
  targetIp: string
): Promise<TGeolocationResponse> {
  const response = await fetch(`https://ipapi.co/${targetIp}/json/`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.reason || "ipapi.co failed to get location data");
  }

  return formatGeoResponse(data, "ipapi");
}

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
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }
  }

  try {
    // Try primary service (ip-api.com) first
    try {
      console.log(
        `[Geolocation] Trying primary service (ip-api.com) for IP: ${targetIp}`
      );
      const data = await getIpApiLocation(targetIp);
      console.log("[Geolocation] ip-api.com success:", {
        targetIp,
        timestamp: requestTimestamp,
      });
      return NextResponse.json(data);
    } catch (primaryError) {
      // Log primary service failure
      console.error("[Geolocation] Primary service failed:", {
        error:
          primaryError instanceof Error ? primaryError.message : primaryError,
        targetIp,
        timestamp: requestTimestamp,
      });

      // Try backup service (ipapi.co)
      console.log(
        `[Geolocation] Trying backup service (ipapi.co) for IP: ${targetIp}`
      );
      const data = await getIpapiLocation(targetIp);
      console.log("[Geolocation] ipapi.co success:", {
        targetIp,
        timestamp: requestTimestamp,
      });
      return NextResponse.json(data);
    }
  } catch (error) {
    // Both services failed
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("[Geolocation] All services timed out:", {
        targetIp,
        timestamp: requestTimestamp,
      });
      return NextResponse.json(
        { error: "Location services timed out. Please try again." },
        { status: 408 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    console.error("[Geolocation] All services failed:", {
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
