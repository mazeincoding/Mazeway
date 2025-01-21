"use client";

import { create } from "zustand";
import { createClient } from "@/utils/supabase/client";
import type { TUser, TUserWithAuth, TTwoFactorMethod } from "@/types/auth";

interface UserState {
  user: TUserWithAuth | null;
  isLoading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  updateUser: (updates: Partial<TUser>) => Promise<void>;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  fetchUser: async () => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        set({ user: null, isLoading: false });
        return;
      }

      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error) throw error;

      // Get MFA factors
      const { data } = await supabase.auth.mfa.listFactors();

      // Get enabled methods
      const enabledMethods: TTwoFactorMethod[] =
        data?.all
          ?.filter((factor) => factor.status === "verified")
          .map((factor) =>
            factor.factor_type === "totp" ? "authenticator" : "sms"
          ) || [];

      // Combine DB user with auth info
      const userWithAuth: TUserWithAuth = {
        ...userData,
        auth: {
          providers:
            authUser.identities?.map((identity) => identity.provider) || [],
          emailVerified: !!authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
          twoFactorEnabled: enabledMethods.length > 0,
          twoFactorMethods: enabledMethods,
        },
      };

      set({ user: userWithAuth, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch user",
        isLoading: false,
      });
    }
  },

  updateUser: async (updates) => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", authUser.id)
        .select()
        .single();

      if (error) throw error;

      const userWithAuth: TUserWithAuth = {
        ...data,
        auth: {
          providers:
            authUser.identities?.map((identity) => identity.provider) || [],
          emailVerified: !!authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
        },
      };

      set({ user: userWithAuth, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update user",
        isLoading: false,
      });
    }
  },

  logout: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, error: null });
  },
}));
