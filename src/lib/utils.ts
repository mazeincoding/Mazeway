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
 * Asserts that the code is running on the server
 * Throws an error if called from the client
 */
export function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("This function can only be called on the server");
  }
}
