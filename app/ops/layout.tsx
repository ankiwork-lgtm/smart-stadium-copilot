/**
 * app/ops/layout.tsx
 *
 * Ops Console layout — wraps /ops/* inside AppShell.
 * NOTE: This project serves pages from the root /app/ directory
 * (API routes confirmed working at /app/api/). Components live in src/components/.
 */

import type { Metadata } from "next";
import { AppShell } from "../../src/components/AppShell";

export const metadata: Metadata = {
  title: "Ops Console — Smart Stadium Companion | FIFA World Cup 2026",
  description:
    "Real-time crowd management dashboard, AI-generated alerts, and shift briefings for stadium operations staff at FIFA World Cup 2026.",
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
