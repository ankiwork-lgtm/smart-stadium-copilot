"use client";
/**
 * src/components/UserContextProvider.tsx
 *
 * React Context + Provider for UserContext (role, language, accessibility).
 * Persists to localStorage so preferences survive page refreshes.
 * Exports `useUserContext()` hook for consuming components.
 *
 * Task 4.1 [MUST]
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserContext } from "../../lib/types";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONTEXT: UserContext = {
  role: "fan",
  language: "en",
  accessibilityNeeds: [],
  currentLocationHint: "",
};

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

type UserContextState = {
  userContext: UserContext;
  setUserContext: (
    ctx: UserContext | ((prev: UserContext) => UserContext)
  ) => void;
};

const UserCtx = createContext<UserContextState>({
  userContext: DEFAULT_CONTEXT,
  setUserContext: () => {},
});

const STORAGE_KEY = "stadium-user-context";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function UserContextProvider({ children }: { children: ReactNode }) {
  const [userContext, setUserContextState] =
    useState<UserContext>(DEFAULT_CONTEXT);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserContext;
        // Ensure required fields exist (graceful migration)
        setUserContextState({
          ...DEFAULT_CONTEXT,
          ...parsed,
        });
      }
    } catch {
      // Silently ignore parse errors — default context remains
    }
  }, []);

  // Sync <html lang="…"> so screen readers use the correct voice engine
  useEffect(() => {
    document.documentElement.lang = userContext.language;
  }, [userContext.language]);

  const setUserContext = (
    ctx: UserContext | ((prev: UserContext) => UserContext)
  ) => {
    setUserContextState((prev) => {
      const next = typeof ctx === "function" ? ctx(prev) : ctx;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage may be unavailable in some contexts — not fatal
      }
      return next;
    });
  };

  return (
    <UserCtx.Provider value={{ userContext, setUserContext }}>
      {children}
    </UserCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUserContext(): UserContextState {
  return useContext(UserCtx);
}
