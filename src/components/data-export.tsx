import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { TDataExportStatus } from "@/types/auth";
import { format } from "date-fns";
import { useDataExports } from "@/hooks/use-data-exports";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getStatusColors(status: TDataExportStatus) {
  switch (status) {
    case "pending":
      return { bg: "rgba(234, 179, 8, 0.15)", text: "rgb(234, 179, 8)" };
    case "processing":
      return { bg: "rgba(59, 130, 246, 0.15)", text: "rgb(59, 130, 246)" };
    case "completed":
      return { bg: "rgba(34, 197, 94, 0.15)", text: "rgb(34, 197, 94)" };
    case "failed":
      return { bg: "rgba(239, 68, 68, 0.15)", text: "rgb(239, 68, 68)" };
    default:
      return { bg: "var(--accent)", text: "var(--foreground)" };
  }
}

export function DataExport() {
  const [isRequesting, setIsRequesting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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
      setShowConfirmDialog(false);
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
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading exports...</div>
      ) : exports.length > 0 ? (
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
              <Badge
                variant="outline"
                style={{
                  backgroundColor: getStatusColors(exportItem.status).bg,
                  color: getStatusColors(exportItem.status).text,
                  borderColor: "transparent",
                }}
              >
                {exportItem.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No exports yet</div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <Button onClick={() => setShowConfirmDialog(true)} className="w-fit">
          Export my data
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export your data</DialogTitle>
            <DialogDescription>
              Are you sure you want to export your data? This can take a while
              to complete. You can close the browser while it's exporting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isRequesting}
            >
              Cancel
            </Button>
            <Button disabled={isRequesting} onClick={handleExportRequest}>
              {isRequesting ? "Requesting..." : "Confirm Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
