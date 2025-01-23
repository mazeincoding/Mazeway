"use client";

import { create } from "zustand";
import type { TUser, TUserWithAuth } from "@/types/auth";
import type { TGetUserResponse, TApiErrorResponse } from "@/types/api";

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
}

export const useUserStore = create<UserState>((set) => ({
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
}));
