import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { TDataExportStatus } from "@/types/auth";
import { format } from "date-fns";
import { useDataExports } from "@/hooks/use-data-exports";

function getStatusBadgeColor(status: TDataExportStatus) {
  switch (status) {
    case "pending":
      return "bg-yellow-500/15 text-yellow-500";
    case "processing":
      return "bg-blue-500/15 text-blue-500";
    case "completed":
      return "bg-green-500/15 text-green-500";
    case "failed":
      return "bg-red-500/15 text-red-500";
    default:
      return "bg-accent text-foreground";
  }
}

export function DataExport() {
  const [isRequesting, setIsRequesting] = useState(false);
  const { exports, isLoading, error, requestExport } = useDataExports();

  // If data exports are disabled, don't render anything
  if (!AUTH_CONFIG.dataExport.enabled) {
    return null;
  }

  const handleExportRequest = async () => {
    try {
      setIsRequesting(true);
      await requestExport();
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

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load exports. Please try refreshing the page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        onClick={handleExportRequest}
        disabled={isRequesting}
        className="w-fit"
      >
        {isRequesting ? "Requesting..." : "Export my data"}
      </Button>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">
          Loading previous exports...
        </div>
      ) : exports.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-foreground">
            Previous exports
          </h3>
          <div className="space-y-3">
            {exports.map((exportItem) => (
              <div
                key={exportItem.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-card-foreground">
                    Requested{" "}
                    {format(
                      new Date(exportItem.created_at),
                      "MMM d, yyyy h:mm a"
                    )}
                  </div>
                  {exportItem.completed_at && (
                    <div className="text-xs text-muted-foreground">
                      Completed{" "}
                      {format(
                        new Date(exportItem.completed_at),
                        "MMM d, yyyy h:mm a"
                      )}
                    </div>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeColor(
                    exportItem.status
                  )}`}
                >
                  {exportItem.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No previous exports</div>
      )}
    </div>
  );
}
