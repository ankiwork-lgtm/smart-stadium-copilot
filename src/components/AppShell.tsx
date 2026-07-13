"use client";
/**
 * src/components/AppShell.tsx
 *
 * Top-level shell with sticky navigation bar, role toggle, language picker,
 * and SimulatedDataBadge. Wraps every page.
 *
 * Task 4.1 [MUST]
 * Task 7.4 [SHOULD] — pre-warms Gemini on first mount so the first real
 *                      assistant call is fast during a live demo.
 */

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUserContext } from "./UserContextProvider";
import { SimulatedDataBadge } from "./SimulatedDataBadge";
import type { UserRole, Language } from "../../lib/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROLES: { value: UserRole; label: string; icon: string }[] = [
  { value: "fan", label: "Fan", icon: "🎉" },
  { value: "ops_staff", label: "Ops", icon: "🛡️" },
  { value: "volunteer", label: "Volunteer", icon: "🤝" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "fr", label: "FR" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: React.ReactNode }) {
  const { userContext, setUserContext } = useUserContext();
  const pathname = usePathname();
  const router = useRouter();

  // Pre-warm the Gemini connection once per session (Task 7.4)
  useEffect(() => {
    fetch("/api/warmup").catch(() => {
      // Best-effort — silently ignore if warmup fails
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-stadium-gradient text-white">
      {/* ----------------------------------------------------------------- */}
      {/* Navigation Bar                                                      */}
      {/* ----------------------------------------------------------------- */}
      <nav
        className="sticky top-0 z-40 border-b border-white/[0.07]
                   bg-stadium-dark/80 backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 group"
            aria-label="Stadium Copilot home"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
              🏟️
            </span>
            <span className="text-sm font-bold text-white/90 hidden sm:block leading-tight">
              Stadium<br />
              <span className="text-[10px] font-normal text-blue-400 tracking-widest uppercase">
                Copilot
              </span>
            </span>
          </Link>

          {/* Page tabs */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-1">
            <button
              id="nav-fan-link"
              onClick={() => {
                setUserContext((prev) => ({ ...prev, role: "fan" }));
                router.push("/fan");
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${
                pathname?.startsWith("/fan")
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              Fan App
            </button>
            <button
              id="nav-ops-link"
              onClick={() => {
                setUserContext((prev) => ({ ...prev, role: "ops_staff" }));
                router.push("/ops");
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${
                pathname?.startsWith("/ops")
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              Ops Console
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Role toggle */}
            <div
              className="flex rounded-lg border border-white/10 overflow-hidden bg-white/[0.03]"
              role="group"
              aria-label="Select role"
            >
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  id={`role-btn-${r.value}`}
                  onClick={() => {
                    setUserContext((prev) => ({ ...prev, role: r.value }));
                    // Navigate to the matching page for fan/ops roles
                    if (r.value === "fan") router.push("/fan");
                    else if (r.value === "ops_staff") router.push("/ops");
                  }}
                  aria-pressed={userContext.role === r.value}
                  title={`Switch to ${r.label} mode`}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    userContext.role === r.value
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span aria-hidden="true">{r.icon}</span>
                  <span className="hidden sm:inline ml-1">{r.label}</span>
                </button>
              ))}
            </div>

            {/* Language picker */}
            <div
              className="flex rounded-lg border border-white/10 overflow-hidden bg-white/[0.03]"
              role="group"
              aria-label="Select language"
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  id={`lang-btn-${l.value}`}
                  onClick={() =>
                    setUserContext((prev) => ({ ...prev, language: l.value }))
                  }
                  aria-pressed={userContext.language === l.value}
                  title={`Switch language to ${l.label}`}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    userContext.language === l.value
                      ? "bg-emerald-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ----------------------------------------------------------------- */}
      {/* Page content                                                        */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 overflow-auto">{children}</main>

      {/* Global disclosure badge */}
      <SimulatedDataBadge />
    </div>
  );
}
