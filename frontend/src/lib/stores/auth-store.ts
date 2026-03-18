"use client";

import { create } from "zustand";

/** 用户信息类型 */
interface UserProfile {
  id: number;
  username: string;
  real_name?: string;
  role_name?: string;
  tenant_id: number;
}

/** 认证状态 Store */
interface AuthState {
  token: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null,
  user: null,

  setAuth: (token, user) => {
    localStorage.setItem("access_token", token);
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    set({ token: null, user: null });
  },
}));
