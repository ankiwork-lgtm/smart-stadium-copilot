/**
 * src/app/ops/layout.tsx
 *
 * Ops Console layout — wraps /ops/* inside AppShell.
 * Mirrors the pattern in src/app/fan/layout.tsx.
 */

import type { Metadata } from "next";
import { AppShell } from "../../components/AppShell";

export const metadata: Metadata = {
  title: "Ops Console — Smart Stadium Companion | FIFA World Cup 2026",
  description:
    "Real-time crowd management dashboard, AI-generated alerts, and shift briefings for stadium operations staff at FIFA World Cup 2026.",
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
