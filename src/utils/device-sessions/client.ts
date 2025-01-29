import { isWithinInterval, subMinutes } from "date-fns";
import { AUTH_CONFIG } from "@/config/auth";

export function isDeviceSessionActive(lastActive: Date) {
  return isWithinInterval(new Date(lastActive), {
    start: subMinutes(
      new Date(),
      AUTH_CONFIG.deviceSessions.considerActiveWithinMinutes
    ),
    end: new Date(),
  });
}
