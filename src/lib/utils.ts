// Generic utilities

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Checks if an IP address is a local/development IP
 * @param ip IP address to check
 * @returns boolean indicating if the IP is local
 */
export function isLocalIP(ip: string): boolean {
  const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost"]);
  return LOCAL_IPS.has(ip);
}
