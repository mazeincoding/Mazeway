"use client";

import { DataExport } from "@/components/data-export";

export default function DataPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-2">
      <h1 className="text-3xl font-bold">Your data</h1>

      <section className="flex flex-col flex-1">
        <h2 className="font-bold text-xl">Data exports</h2>
        <p className="text-muted-foreground mt-1">
          Download a copy of your personal data. We'll email you when it's
          ready.
        </p>
        <div className="mt-4">
          <DataExport />
        </div>
      </section>
    </div>
  );
}
