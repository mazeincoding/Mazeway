import { TDeviceInfo, TDeviceSession } from "@/types/auth";

export function calculateDeviceConfidence(
  storedSessions: TDeviceSession[] | null,
  current: TDeviceInfo
): number {
  // First device login gets high confidence
  if (!storedSessions?.length) {
    return 100;
  }

  // Calculate confidence against each stored device and return highest score
  const scores = storedSessions.map((session) => {
    let score = 0;
    const stored = session.device;

    // Device name match (30 points)
    if (stored.device_name === current.device_name) {
      score += 30;
    }

    // Browser match (20 points)
    if (stored.browser === current.browser) {
      score += 20;
    }

    // OS match - base name only (20 points)
    if (stored.os && current.os) {
      const storedBase = stored.os.split(" ")[0];
      const currentBase = current.os.split(" ")[0];
      if (storedBase === currentBase) {
        score += 20;
      }
    }

    // IP range match (15 points)
    if (stored.ip_address && current.ip_address) {
      const storedIP = stored.ip_address.split(".").slice(0, 3).join(".");
      const currentIP = current.ip_address.split(".").slice(0, 3).join(".");
      if (storedIP === currentIP) {
        score += 15;
      }
    }

    return score;
  });

  // Return the highest confidence score found
  return Math.max(...scores);
}

export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
