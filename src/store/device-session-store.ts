"use client";

import { create } from "zustand";
import { DeviceSession } from "@/types/auth";
import {
  getDeviceSessions,
  deleteDeviceSession,
} from "@/actions/auth/device-sessions";

interface DeviceSessionState {
  sessions: DeviceSession[] | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (userId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export const useDeviceSessionStore = create<DeviceSessionState>((set) => ({
  sessions: null,
  isLoading: false,
  error: null,

  fetchSessions: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await getDeviceSessions(userId);
    set({ sessions: data, error: error, isLoading: false });
  },

  deleteSession: async (sessionId: string) => {
    const { error } = await deleteDeviceSession(sessionId);
    if (!error) {
      set((state) => ({
        sessions:
          state.sessions?.filter((s) => s.session_id !== sessionId) ?? null,
      }));
    }
  },
}));
