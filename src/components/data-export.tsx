import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/utils/api";
import { AUTH_CONFIG } from "@/config/auth";

export function DataExport() {
  const [isRequesting, setIsRequesting] = useState(false);

  // If data exports are disabled, don't render anything
  if (!AUTH_CONFIG.dataExport.enabled) {
    return null;
  }

  const requestExport = async () => {
    try {
      setIsRequesting(true);
      await api.auth.dataExport.create();

      toast.success("Export requested", {
        description: "We'll email you when your data is ready to download.",
      });
    } catch (error) {
      console.error("Failed to request export:", error);
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Please try again later",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={requestExport} disabled={isRequesting} className="w-fit">
        {isRequesting ? "Requesting..." : "Export my data"}
      </Button>
    </div>
  );
}
