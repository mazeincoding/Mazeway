"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/user-store";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { fetchUser } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return <>{children}</>;
} 