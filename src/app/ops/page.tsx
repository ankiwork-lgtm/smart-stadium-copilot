"use client";
/**
 * src/app/ops/page.tsx
 *
 * Ops Console — three-column layout (desktop) / tab-driven (mobile):
 *   Left:   CrowdDashboard + TriggerSpikeButton (5.1 + 5.2)
 *   Center: AlertsFeed (5.3)
 *   Right:  BriefingPanel + OpsAskBar (5.4 + 5.5)
 *
 * Tasks: 5.1 [MUST] · 5.2 [MUST] · 5.3 [SHOULD] · 5.4 [SHOULD] · 5.5 [COULD]
 */

import { useState } from "react";
import { CrowdDashboard } from "../../components/CrowdDashboard";
import { AlertsFeed } from "../../components/AlertsFeed";
import { BriefingPanel } from "../../components/BriefingPanel";
import { ChatPanel } from "../../components/ChatPanel";
import { SustainabilityCard } from "../../components/SustainabilityCard";
import { useUserContext } from "../../components/UserContextProvider";
import type { AssistantMode } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Tab config (mobile / narrow views collapse into tabs)
// ---------------------------------------------------------------------------

type TabId = "dashboard" | "alerts" | "briefing" | "ask" | "sustainability";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "alerts", label: "Alerts", icon: "🔔" },
  { id: "briefing", label: "Briefing", icon: "📋" },
  { id: "ask", label: "Ask AI", icon: "🤖" },
  { id: "sustainability", label: "Green", icon: "🌿" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OpsPage() {
  const { userContext } = useUserContext();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [alertBadge, setAlertBadge] = useState(false);
  const [spikeCount, setSpikeCount] = useState(0);

  const isOps = userContext.role === "ops_staff";

  const handleSpikeTriggered = () => {
    setSpikeCount((c) => c + 1);
    // Auto-switch to Alerts tab on mobile after spike
    setActiveTab("alerts");
    setAlertBadge(true);
    setTimeout(() => setAlertBadge(false), 4000);
  };

  return (
    <div
      className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4"
      style={{ minHeight: "calc(100vh - 3.5rem)" }}
    >
      {/* ------------------------------------------------------------------- */}
      {/* Page header                                                           */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-4 shrink-0 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Ops Console
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Legacy Stadium · Dallas, TX · FIFA World Cup 2026
          </p>
        </div>

        {/* Live indicator */}
        <div
          className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07]
                        rounded-xl px-3 py-2"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-400 font-medium">
            Live · Polling every 5s
          </span>
          {spikeCount > 0 && (
            <span className="ml-1 text-[10px] text-red-400 font-semibold">
              · {spikeCount} spike{spikeCount > 1 ? "s" : ""} triggered
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Role notice (if not Ops)                                              */}
      {/* ------------------------------------------------------------------- */}
      {!isOps && (
        <div
          className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5
                        flex items-center gap-2 text-xs text-amber-300"
        >
          <span>⚠️</span>
          <span>
            You&apos;re viewing Ops Console as{" "}
            <strong>{userContext.role}</strong>. Switch to the{" "}
            <strong>Ops</strong> role in the top nav for full access.
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Mobile tab navigation                                                 */}
      {/* ------------------------------------------------------------------- */}
      <div className="xl:hidden flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`ops-tab-${tab.id}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "alerts") setAlertBadge(false);
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold
                        transition-all duration-200 relative
                        ${
                          activeTab === tab.id
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                            : "text-gray-300 hover:text-white hover:bg-white/10"
                        }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {/* Alert badge */}
            {tab.id === "alerts" && alertBadge && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Desktop: 3-column grid / Mobile: single-panel (tab-driven)           */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex-1 xl:grid xl:grid-cols-[1.1fr_1fr_1fr] gap-4 min-h-0">

        {/* ======= LEFT — Crowd Dashboard + Sustainability Card ======= */}
        <div
          className={`flex flex-col gap-3 min-h-0 overflow-y-auto chat-scroll
                      ${activeTab === "dashboard" || activeTab === "sustainability" ? "block" : "hidden xl:block"}`}
        >
          {/* Crowd Dashboard */}
          <div
            className={`rounded-2xl bg-white/[0.025] border border-white/[0.07]
                           overflow-hidden
                           ${activeTab === "sustainability" ? "hidden xl:block" : "block"}`}
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-base">📊</span>
              <h2 className="text-xs font-semibold text-gray-300">Crowd Dashboard</h2>
            </div>
            <div className="p-4">
              <CrowdDashboard onSpikeTriggered={handleSpikeTriggered} hideSpikeButton={!isOps} />
            </div>
          </div>

          {/* Sustainability Card */}
          <div
            className={`rounded-2xl bg-white/[0.025] border border-white/[0.07]
                           overflow-hidden
                           ${activeTab === "dashboard" ? "hidden xl:block" : "block"}`}
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-base">🌿</span>
              <h2 className="text-xs font-semibold text-gray-300">Sustainability</h2>
              <span className="ml-auto text-[10px] text-gray-400">Simulated · FIFA 2026</span>
            </div>
            <div className="p-4">
              <SustainabilityCard />
            </div>
          </div>
        </div>

        {/* ======= CENTER — Alerts Feed ======= */}
        <div
          className={`flex flex-col gap-3 min-h-0
                      ${activeTab === "alerts" ? "flex" : "hidden xl:flex"}`}
        >
          <div
            className="rounded-2xl bg-white/[0.025] border border-white/[0.07]
                          overflow-hidden flex flex-col flex-1"
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">🔔</span>
                <h2 className="text-xs font-semibold text-gray-300">AI Alerts Feed</h2>
              </div>
              <span className="text-[10px] text-gray-400">AI-generated · auto-refresh</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto chat-scroll">
              <AlertsFeed onNewHighAlert={() => setAlertBadge(true)} />
            </div>
          </div>
        </div>

        {/* ======= RIGHT — Briefing + Ask AI ======= */}
        <div
          className={`flex flex-col gap-4 min-h-0
                      ${
                        activeTab === "briefing" || activeTab === "ask"
                          ? "flex"
                          : "hidden xl:flex"
                      }`}
        >
          {/* Briefing Panel */}
          <div
            className={`rounded-2xl bg-white/[0.025] border border-white/[0.07]
                           overflow-hidden shrink-0
                           ${
                             activeTab === "ask"
                               ? "hidden xl:block"
                               : "block"
                           }`}
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-base">📋</span>
              <h2 className="text-xs font-semibold text-gray-300">Shift Briefing</h2>
            </div>
            <div className="p-4">
              <BriefingPanel />
            </div>
          </div>

          {/* OpsAskBar — reuses ChatPanel (Task 5.5 COULD) */}
          <div
            className={`rounded-2xl bg-white/[0.025] border border-white/[0.07]
                           flex flex-col flex-1 min-h-0 overflow-hidden
                           ${
                             activeTab === "briefing"
                               ? "hidden xl:flex"
                               : "flex"
                           }`}
            style={{ minHeight: 320 }}
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <h2 className="text-xs font-semibold text-gray-300">Ask the AI</h2>
              </div>
              <span
                className="text-[10px] bg-indigo-500/10 border border-indigo-500/20
                               px-2 py-0.5 rounded-full text-indigo-400"
              >
                ops_alert mode
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ChatPanel mode={"ops_alert" as AssistantMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
