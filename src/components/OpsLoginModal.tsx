"use client";
/**
 * src/components/OpsLoginModal.tsx
 *
 * PIN-entry modal for authenticating as ops_staff.
 * Calls POST /api/auth/login with the entered PIN; on success the server sets
 * an httpOnly signed session cookie and the parent is notified via onSuccess().
 *
 * The default demo PIN is "1234" (configurable via OPS_STAFF_PIN env var).
 */

import { useState, useRef, useEffect, type FormEvent } from "react";

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
};

export function OpsLoginModal({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus PIN input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, role: "ops_staff" }),
      });

      if (res.ok) {
        setPin("");
        onSuccess();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Login failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ops-login-title"
    >
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl" aria-hidden="true">🛡️</span>
          <div>
            <h2
              id="ops-login-title"
              className="text-base font-bold text-white"
            >
              Ops Staff Login
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Enter your PIN to access the Ops Console
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* PIN input */}
          <div className="mb-4">
            <label
              htmlFor="ops-pin-input"
              className="block text-xs font-semibold text-gray-300 mb-1.5"
            >
              PIN
            </label>
            <input
              ref={inputRef}
              id="ops-pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              placeholder="Enter PIN"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg
                         px-3 py-2.5 text-sm text-white placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/60
                         focus:border-indigo-500/60 transition-all"
              aria-describedby={error ? "ops-login-error" : undefined}
              disabled={loading}
            />
          </div>

          {/* Error message */}
          {error && (
            <p
              id="ops-login-error"
              role="alert"
              className="text-xs text-red-400 mb-4 flex items-center gap-1.5"
            >
              <span aria-hidden="true">⚠️</span>
              {error}
            </p>
          )}

          {/* Demo hint */}
          <p className="text-[11px] text-gray-500 mb-4">
            Demo PIN: <code className="text-gray-400 bg-white/[0.05] px-1 rounded">1234</code>
          </p>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-gray-300
                         border border-white/10 hover:bg-white/[0.06]
                         transition-all duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || pin.length === 0}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white
                         bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                         disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? "Verifying…" : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
