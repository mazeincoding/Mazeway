"use client";

import { Confirm } from "@/components/auth-confirm";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ErrorPage() {
  const [showConfirm, setShowConfirm] = useState(true);
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Confirm
        email=""
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
        isError={true}
        errorType={errorType}
      />
    </div>
  );
}
