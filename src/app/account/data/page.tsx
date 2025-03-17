"use client";

import { Database } from "lucide-react";
import { SettingCard } from "@/components/setting-card";
import { DataExport } from "@/components/data-export";

export default function DataPage() {
  return (
    <div className="flex flex-col gap-8">
      <SettingCard icon={Database}>
        <SettingCard.Header>
          <SettingCard.Title>Export your data</SettingCard.Title>
          <SettingCard.Description>
            Download a copy of your personal data. We'll email you when it's
            ready.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <DataExport />
        </SettingCard.Content>
      </SettingCard>
    </div>
  );
}
