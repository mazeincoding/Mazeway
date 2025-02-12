"use client";

import { create } from "zustand";
import type { TTwoFactorMethod, TUser, TUserWithAuth } from "@/types/auth";
import type { TGetUserResponse, TApiErrorResponse } from "@/types/api";
import { createClient } from "@/utils/supabase/client";
import { getFactorIdForMethod } from "@/utils/auth";

interface UserState {
  user: TUserWithAuth | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: TUserWithAuth | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateUser: (updates: Partial<TUser>) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  getFactorForMethod: (
    method: TTwoFactorMethod
  ) => Promise<{ factorId: string } | null>;
  disable2FA: (method: TTwoFactorMethod, code: string) => Promise<void>;
  setup2FA: (method: TTwoFactorMethod, phone?: string) => Promise<void>;
  verify2FA: (
    method: TTwoFactorMethod,
    code: string,
    phone?: string
  ) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  updateUser: (updates) => {
    set((state) => {
      if (!state.user) return state;

      const updatedUser: TUserWithAuth = {
        ...state.user,
        ...updates,
      };

      return { user: updatedUser, error: null };
    });
  },

  logout: () => {
    set({ user: null, error: null });
  },

  refreshUser: async () => {
    set({ isLoading: true, error: null });

    const response = await fetch("/api/user").catch(() => {
      set({ error: "Failed to fetch user", isLoading: false });
      return null;
    });

    if (!response) return;

    if (!response.ok) {
      const { error } = (await response.json()) as TApiErrorResponse;
      set({ error, isLoading: false });
      return;
    }

    const { user } = (await response.json()) as TGetUserResponse;
    set({ user, isLoading: false });
  },

  getFactorForMethod: async (method) => {
    const supabase = createClient();
    const factorId = await getFactorIdForMethod(supabase, method);
    if (!factorId) return null;
    return { factorId };
  },

  disable2FA: async (method, code) => {
    const factor = await get().getFactorForMethod(method);
    if (!factor) {
      throw new Error("2FA method not found");
    }

    const response = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factorId: factor.factorId,
        method,
        code,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to disable 2FA");
    }

    await get().refreshUser();
  },

  setup2FA: async (method, phone) => {
    const response = await fetch("/api/auth/2fa/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, phone }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to setup 2FA");
    }

    return response.json();
  },

  verify2FA: async (method, code, phone) => {
    const factor = await get().getFactorForMethod(method);
    if (!factor) {
      throw new Error("2FA method not found");
    }

    const response = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factorId: factor.factorId,
        method,
        code,
        phone,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to verify 2FA");
    }

    await get().refreshUser();
  },
}));
