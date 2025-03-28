"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { toast } from "sonner";

function URLErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const shownMessages = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (message && !shownMessages.current.has(message)) {
      shownMessages.current.add(message);
      toast.message(message, {
        duration: 5000,
      });
    }
  }, [message]);

  return null;
}

export function URLErrorHandler() {
  return (
    <Suspense fallback={null}>
      <URLErrorContent />
    </Suspense>
  );
}
