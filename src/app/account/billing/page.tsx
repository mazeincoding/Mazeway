"use client";

import { CreditCard } from "lucide-react";
import { SettingCard } from "@/components/setting-card";

export default function Billing() {
  return (
    <div className="flex flex-col gap-8">
      <SettingCard icon={CreditCard}>
        <SettingCard.Header>
          <SettingCard.Title>Billing information</SettingCard.Title>
          <SettingCard.Description>
            Manage your billing information and subscription.
          </SettingCard.Description>
        </SettingCard.Header>
        <SettingCard.Content>
          <p className="text-muted-foreground">No billing information available.</p>
        </SettingCard.Content>
      </SettingCard>
    </div>
  );
}