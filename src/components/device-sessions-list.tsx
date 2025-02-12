"use client";
import { useState, useEffect } from "react";
import { SmartphoneIcon, LaptopMinimalIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { TDeviceSession, TTwoFactorMethod } from "@/types/auth";
import { TGeolocationResponse } from "@/types/api";
import { isLocalIP } from "@/utils/auth";
import { useDeviceSessions } from "@/hooks/use-device-sessions";
import { TwoFactorVerifyForm } from "./2fa-verify-form";

export function DeviceSessionsList() {
  const { sessions, isLoading, error, refresh } = useDeviceSessions();
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    availableMethods: Array<{ type: TTwoFactorMethod; factorId: string }>;
    sessionId: string;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null
  );
  const [currentSession, setCurrentSession] = useState<TDeviceSession | null>(
    null
  );

  // Get the current device session
  useEffect(() => {
    async function fetchCurrentSession() {
      try {
        const response = await fetch("/api/auth/device-sessions/current");
        const data = await response.json();

        if (!response.ok) {
          console.error("[DEBUG] Failed to get current session:", data.error);
          return;
        }

        setCurrentSession(data.data);
      } catch (err) {
        console.error("[DEBUG] Error fetching current session:", err);
      }
    }

    fetchCurrentSession();
  }, []);

  // Sort sessions to put current device first
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.session_id === currentSession?.session_id) return -1;
    if (b.session_id === currentSession?.session_id) return 1;
    return 0;
  });

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevokingSessionId(sessionId);
      const response = await fetch(`/api/auth/device-sessions/${sessionId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 4000,
          });
          return;
        }

        toast.error("Error", {
          description: data.error || "Failed to revoke device session",
          duration: 3000,
        });
        return;
      }

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        setTwoFactorData({
          factorId: data.factorId,
          availableMethods: data.availableMethods,
          sessionId: sessionId,
        });
        setShowTwoFactorDialog(true);
        return;
      }

      // Success
      toast.success("Device logged out", {
        description: "The device has been logged out successfully.",
        duration: 3000,
      });
      refresh();
    } catch (err) {
      console.error("Error revoking device session:", err);
      toast.error("Error", {
        description: "Failed to revoke device session",
        duration: 3000,
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleVerify2FA = async (code: string) => {
    if (!twoFactorData) return;

    try {
      setIsVerifying(true);
      setVerifyError(null);

      // Send 2FA verification to the same endpoint
      const response = await fetch(
        `/api/auth/device-sessions/${twoFactorData.sessionId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            factorId: twoFactorData.factorId,
            code,
            method:
              twoFactorData.availableMethods.find(
                (m) => m.factorId === twoFactorData.factorId
              )?.type || "authenticator",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Too many attempts", {
            description: "Please wait a moment before trying again.",
            duration: 4000,
          });
          return;
        }

        setVerifyError(data.error || "Failed to verify code");
        return;
      }

      // Success
      toast.success("Device logged out", {
        description: "The device has been logged out successfully.",
        duration: 3000,
      });

      // Clear state and refresh list
      setTwoFactorData(null);
      setShowTwoFactorDialog(false);
      refresh();
    } catch (err) {
      console.error("Error verifying 2FA:", err);
      setVerifyError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (error) {
    return <div className="text-destructive w-full">{error}</div>;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center text-muted-foreground">No devices found</div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {sortedSessions.map((session) => (
          <DeviceItem
            key={session.id}
            sessionId={session.session_id}
            deviceName={session.device.device_name}
            browser={session.device.browser || "Unknown browser"}
            deviceIcon={
              session.device.device_name.toLowerCase().includes("iphone") ||
              session.device.device_name.toLowerCase().includes("android") ? (
                <SmartphoneIcon className="flex-shrink-0 w-6 h-6" />
              ) : (
                <LaptopMinimalIcon className="flex-shrink-0 w-6 h-6" />
              )
            }
            onRevoke={handleRevoke}
            isRevoking={revokingSessionId === session.session_id}
            isCurrentDevice={session.session_id === currentSession?.session_id}
            os={session.device.os}
            ipAddress={session.device.ip_address}
          />
        ))}
      </div>

      {showTwoFactorDialog && twoFactorData && (
        <Dialog
          open={showTwoFactorDialog}
          onOpenChange={setShowTwoFactorDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>
                Please enter your two-factor authentication code to continue.
              </DialogDescription>
            </DialogHeader>
            <TwoFactorVerifyForm
              factorId={twoFactorData.factorId}
              availableMethods={twoFactorData.availableMethods}
              onVerify={handleVerify2FA}
              isVerifying={isVerifying}
              error={verifyError}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

interface DeviceItemProps {
  deviceName: string;
  browser: string;
  deviceIcon: React.ReactNode;
  sessionId: string;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
  isCurrentDevice?: boolean;
  os: string | null;
  ipAddress?: string;
}

function DeviceItem({
  deviceName,
  browser,
  deviceIcon,
  sessionId,
  onRevoke,
  isRevoking,
  isCurrentDevice,
  os,
  ipAddress,
}: DeviceItemProps) {
  const [location, setLocation] = useState<TGeolocationResponse["data"] | null>(
    null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only fetch location when dialog opens and we haven't fetched it yet
  useEffect(() => {
    async function fetchLocation() {
      if (!ipAddress || !dialogOpen || location || isLoadingLocation) return;

      // Skip API call for local IPs
      if (isLocalIP(ipAddress)) {
        setLocation({
          city: "Local Development",
          region: undefined,
          country: undefined,
        });
        return;
      }

      try {
        setIsLoadingLocation(true);
        setLocationError(null);
        const response = await fetch(
          `/api/auth/device-sessions/geolocation?ip=${encodeURIComponent(ipAddress)}`
        );
        const data = await response.json();

        if (!response.ok) {
          setLocationError(
            response.status === 429
              ? "Location service is busy. Try again later."
              : "Couldn't get location information."
          );
          return;
        }

        setLocation(data.data);
      } catch (err) {
        console.error("Error fetching location:", err);
        setLocationError("Couldn't get location information.");
      } finally {
        setIsLoadingLocation(false);
      }
    }

    fetchLocation();
  }, [ipAddress, dialogOpen, location, isLoadingLocation]);

  const content = (
    <div
      className={`flex items-center justify-between border p-4 px-6 rounded-lg ${
        !isCurrentDevice && "cursor-pointer hover:bg-accent"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">{deviceIcon}</div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{deviceName}</h3>
            {isCurrentDevice && <Badge>Current device</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{browser}</p>
        </div>
      </div>
    </div>
  );

  if (isCurrentDevice) {
    return content;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{content}</DialogTrigger>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>{deviceName}</DialogTitle>
          <DialogDescription>
            This device has been logged in to your account.
          </DialogDescription>
        </DialogHeader>
        <InfoItem label="Device name" value={deviceName} />
        <InfoItem label="Browser" value={browser} />
        {os && <InfoItem label="Operating System" value={os} />}
        {location && (
          <InfoItem
            label="Location"
            value={[location.city, location.region, location.country]
              .filter(Boolean)
              .join(", ")}
          />
        )}
        {isLoadingLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" /> Loading
            location...
          </div>
        )}
        {locationError && (
          <div className="text-sm text-muted-foreground">{locationError}</div>
        )}
        <DialogFooter>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onRevoke(sessionId)}
            disabled={isRevoking}
          >
            {isRevoking ? "Logging out..." : "Log out from this device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
