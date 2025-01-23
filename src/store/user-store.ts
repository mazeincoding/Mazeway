"use client";

import { create } from "zustand";
import type { TUser, TUserWithAuth } from "@/types/auth";

interface UserState {
  user: TUserWithAuth | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: TUserWithAuth | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateUser: (updates: Partial<TUser>) => void;
  logout: () => void;
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
}));
