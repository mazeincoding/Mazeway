/**
 * Shared utilities for device session management
 * These functions work in both client and server contexts
 */

/**
 * Gets the current device session ID from cookies
 * Works in both client and server contexts
 * @param request Optional Request object (server-side only)
 * @returns The device session ID or null if not found
 */
export function getCurrentDeviceSessionId(request?: Request): string | null {
  // Server-side: Use Request object if available
  if (request) {
    return (
      request.headers
        .get("cookie")
        ?.split("; ")
        .find((cookie) => cookie.startsWith("device_session_id="))
        ?.split("=")[1] || null
    );
  }

  // Client-side: Use document.cookie
  if (typeof document !== "undefined") {
    return (
      document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("device_session_id="))
        ?.split("=")[1] || null
    );
  }

  return null;
}
