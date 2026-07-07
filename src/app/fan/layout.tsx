/**
 * src/app/fan/layout.tsx
 *
 * Fan App layout — wraps all /fan/* routes inside AppShell
 * (sticky nav, role toggle, language picker, SimulatedDataBadge).
 *
 * AppShell is a Client Component, so we import it directly here.
 * This Server Component acts purely as a shell/metadata host.
 */

import type { Metadata } from "next";
import { AppShell } from "../../components/AppShell";

export const metadata: Metadata = {
  title: "Fan App — Smart Stadium Companion | FIFA World Cup 2026",
  description:
    "Your AI-powered guide for wayfinding, transport, and accessibility at the FIFA World Cup 2026 stadium.",
};

export default function FanLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
