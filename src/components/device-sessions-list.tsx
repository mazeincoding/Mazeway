"use client";
import { useState, useEffect } from "react";
import {
  SmartphoneIcon,
  LaptopMinimalIcon,
  Loader2,
  InfoIcon,
} from "lucide-react";
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
import { api } from "@/utils/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DeviceSessionsList() {
  const { sessions, isLoading, error, refresh } = useDeviceSessions();
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

  const sortedSessions = [...sessions].sort((a, b) => {
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

  if (sessions.length === 0) {
    return (
      <div className="text-center text-muted-foreground">No devices found</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">{deviceIcon}</div>
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold">
            {deviceName}
            {isCurrentDevice && (
              <Badge variant="outline" className="ml-2">
                Current device
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            {[browser, os].filter(Boolean).join(" • ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isCurrentDevice && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogoutClick}
              disabled={isLoading}
            >
              {isRevoking ? "Logging out..." : "Log out"}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" type="button">
                  <InfoIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Device details</h4>
                    <p className="text-sm text-muted-foreground">
                      Information about this device session
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm text-muted-foreground">
                        Device
                      </Label>
                      <span className="col-span-2 text-sm">{deviceName}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm text-muted-foreground">
                        Browser
                      </Label>
                      <span className="col-span-2 text-sm">{browser}</span>
                    </div>
                    {os && (
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-sm text-muted-foreground">
                          OS
                        </Label>
                        <span className="col-span-2 text-sm">{os}</span>
                      </div>
                    )}
                    {location && (
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-sm text-muted-foreground">
                          Location
                        </Label>
                        <span className="col-span-2 text-sm">
                          {[location.city, location.region, location.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {isLoadingLocation && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading location...
                      </div>
                    )}
                    {locationError && (
                      <p className="text-sm text-muted-foreground">
                        {locationError}
                      </p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    </div>
  );

  if (isCurrentDevice) {
    return content;
  }

  return (
    <>
      {content}
      <Dialog
        open={!!verificationData}
        onOpenChange={(open) => {
          if (!open) {
            setVerificationData(null);
            setIsVerifying(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your identity</DialogTitle>
            <DialogDescription>
              To log out this device, please verify your identity
            </DialogDescription>
          </DialogHeader>

          {verificationData && (
            <VerifyForm
              availableMethods={verificationData.availableMethods}
              onVerifyComplete={handleVerifyComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
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
