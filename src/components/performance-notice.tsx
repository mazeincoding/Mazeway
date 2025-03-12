"use client";

import { usePathname } from "next/navigation";

export function PerformanceNotice() {
  const pathname = usePathname();
  const shouldShow =
    pathname.startsWith("/account") || pathname.startsWith("/dashboard");

  if (!shouldShow) return null;

  return (
    <div className="border-b bg-muted/50">
      <div className="container flex items-center gap-2 py-2">
        <div className="flex-1 text-center text-sm text-muted-foreground">
          <span className="mr-2">🚧</span>
          Site performance is temporarily slower - we're working on making it
          faster!
          <span className="ml-2">🚀</span>
        </div>
      </div>
    </div>
  );
}
