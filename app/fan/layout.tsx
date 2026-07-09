/**
 * app/fan/layout.tsx
 *
 * Fan App layout — wraps all /fan/* routes inside AppShell.
 * Import paths point to src/ since this file lives at root /app/.
 */

import type { Metadata } from "next";
import { AppShell } from "../../src/components/AppShell";

export const metadata: Metadata = {
  title: "Fan App — Smart Stadium Companion | FIFA World Cup 2026",
  description:
    "Your AI-powered guide for wayfinding, transport, and accessibility at the FIFA World Cup 2026 stadium.",
};

export default function FanLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
