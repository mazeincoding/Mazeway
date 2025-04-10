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
import { TDeviceSession, TVerificationFactor } from "@/types/auth";
import { TGeolocationResponse } from "@/types/api";
import { isLocalIP } from "@/lib/utils";
import { useDeviceSessions } from "@/hooks/use-device-sessions";
import { VerifyForm } from "./verify-form";
import { RevokeAllDevicesButton } from "./revoke-all-devices-button";
import { api } from "@/utils/api";

export function DeviceSessionsList() {
  const { deviceSessions, isLoading, error, refresh } = useDeviceSessions();
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null
  );
  const [currentSession, setCurrentSession] = useState<TDeviceSession | null>(
    null
  );

  useEffect(() => {
    async function fetchCurrentSession() {
      try {
        const { data } = await api.auth.device.getCurrent();
        setCurrentSession(data);
      } catch (err) {
        console.error("Error fetching current session:", err);
      }
    }

    fetchCurrentSession();
  }, []);

  const sortedSessions = [...deviceSessions].sort((a, b) => {
    if (a.id === currentSession?.id) return -1;
    if (b.id === currentSession?.id) return 1;
    return 0;
  });

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevokingSessionId(sessionId);

      await api.auth.device.revokeSession({
        sessionId,
      });

      toast.success("Device logged out", {
        description: "The device has been logged out successfully.",
        duration: 3000,
      });

      refresh();
    } catch (error) {
      console.error("Error during device revocation:", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setRevokingSessionId(null);
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

  if (deviceSessions.length === 0) {
    return (
      <div className="text-center text-muted-foreground">No devices found</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RevokeAllDevicesButton
        deviceSessions={deviceSessions}
        onSuccess={refresh}
      />

      {sortedSessions.map((session) => (
        <DeviceItem
          key={session.id}
          sessionId={session.id}
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
          isRevoking={revokingSessionId === session.id}
          isCurrentDevice={session.id === currentSession?.id}
          os={session.device.os}
          ipAddress={session.device.ip_address}
        />
      ))}
    </div>
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
  const [verificationData, setVerificationData] = useState<{
    availableMethods: TVerificationFactor[];
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const isLoading = isRevoking || isVerifying;

  useEffect(() => {
    async function fetchLocation() {
      if (!ipAddress || !dialogOpen || location || isLoadingLocation) return;

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
        const { data } = await api.auth.device.getGeolocation(ipAddress);
        setLocation(data);
      } catch (err) {
        console.error("Error fetching location:", err);
        if (err instanceof Error && err.message.includes("429")) {
          setLocationError("Location service is busy. Try again later.");
        } else {
          setLocationError("Couldn't get location information.");
        }
      } finally {
        setIsLoadingLocation(false);
      }
    }

    fetchLocation();
  }, [ipAddress, dialogOpen, location, isLoadingLocation]);

  const handleLogoutClick = async () => {
    try {
      setIsVerifying(true);
      const data = await api.auth.device.revokeSession({
        sessionId,
        checkVerificationOnly: true,
      });

      if (
        data.requiresVerification &&
        data.availableMethods &&
        data.availableMethods.length > 0
      ) {
        setVerificationData({
          availableMethods: data.availableMethods,
        });
        return;
      }

      onRevoke(sessionId);
    } catch (error) {
      console.error("Error checking verification:", error);
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyComplete = () => {
    onRevoke(sessionId);
    setVerificationData(null);
  };

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
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setIsVerifying(false);
        }
      }}
    >
      <DialogTrigger asChild>{content}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {verificationData ? "Verify your identity" : "Device details"}
          </DialogTitle>
          <DialogDescription>
            {verificationData
              ? "To log out this device, please verify your identity"
              : "View details about this device and log out"}
          </DialogDescription>
        </DialogHeader>

        {!verificationData ? (
          <>
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
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />{" "}
                Loading location...
              </div>
            )}
            {locationError && (
              <div className="text-sm text-muted-foreground">
                {locationError}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLogoutClick}
                disabled={isLoading}
              >
                {isRevoking
                  ? "Logging out..."
                  : isVerifying
                    ? "Checking..."
                    : "Log out from this device"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <VerifyForm
            availableMethods={verificationData.availableMethods}
            onVerifyComplete={handleVerifyComplete}
          />
        )}
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
