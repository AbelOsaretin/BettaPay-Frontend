"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/store/authStore";

/** Returns the localStorage key scoped to the current user (or guest). */
export function getThemeStorageKey(userId: string | null): string {
  return `bp_theme__${userId ?? "guest"}`;
}

const VALID_THEMES = new Set(["light", "dark", "system"]);

/**
 * useThemePreference
 *
 * Side-effect hook — mount it once near the top of the authenticated shell.
 *
 * Responsibilities:
 *  1. Restore the persisted theme for the current user on mount.
 *  2. Migrate guest preference → user-scoped key on login.
 *  3. Clear the user-scoped key on logout (so the next user starts fresh).
 *  4. Re-sync live OS colour-scheme changes while in "system" mode.
 */
export function useThemePreference(): void {
  const { theme, setTheme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const prevUserIdRef = useRef<string | null>(userId);

  // ── 1. Restore preference on mount (Hydration Safe) ─────────────────────
  const getSnapshot = () => {
    const key = getThemeStorageKey(userId);
    return window.localStorage.getItem(key);
  };
  const getServerSnapshot = () => null;
  const subscribe = () => () => {}; // We handle changes via other effects

  const storedTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (storedTheme && VALID_THEMES.has(storedTheme)) {
      setTheme(storedTheme);
    }
  }, [storedTheme, setTheme]);

  // ── 2. Handle user identity transitions (login / logout) ─────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (prev === userId) return; // no transition

    if (prev === null && userId !== null) {
      // Login: migrate guest preference to user-scoped key, then restore.
      const guestKey = getThemeStorageKey(null);
      const userKey = getThemeStorageKey(userId);
      const guestStored = localStorage.getItem(guestKey);
      if (guestStored && VALID_THEMES.has(guestStored)) {
        localStorage.setItem(userKey, guestStored);
        setTheme(guestStored);
      } else {
        // No guest pref — check if this user had a prior preference.
        const userStored = localStorage.getItem(userKey);
        if (userStored && VALID_THEMES.has(userStored)) {
          setTheme(userStored);
        }
      }
    } else if (prev !== null && userId === null) {
      // Logout: do NOT carry the theme forward; next-themes will fall back
      // to the defaultTheme ("system") on the next page load.
      const userKey = getThemeStorageKey(prev);
      localStorage.removeItem(userKey);
    }
  }, [userId, setTheme]);

  // ── 3. Persist on every theme change ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !theme) return;
    if (!VALID_THEMES.has(theme)) return;
    const key = getThemeStorageKey(userId);
    localStorage.setItem(key, theme);
  }, [theme, userId]);

  // ── 4. Live OS colour-scheme sync while in "system" mode ─────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      // Re-read current theme from storage (theme closure may be stale).
      const key = getThemeStorageKey(userId);
      const stored = localStorage.getItem(key) ?? "system";
      if (stored === "system") {
        // Force next-themes to re-resolve the OS value.
        setTheme("system");
      }
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [userId, setTheme]);
}
