"use client";
/**
 * src/components/ChatPanel.tsx
 *
 * Streaming chat panel wired to POST /api/assistant.
 * - Reads UserContext (role, language, accessibilityNeeds) automatically
 * - Accepts a `mode` prop (set by IntentChips or fan page)
 * - Streams response token-by-token via ReadableStream + TextDecoder
 * - Animated streaming cursor while generating
 * - Friendly error state on API failure (NFR2)
 * - For volunteer role: shows a "Translation mode" header in assistant messages
 * - Welcome message updates when language changes
 *
 * Task 4.3 [MUST] + Task 4.4 [MUST] + Task 4.9 [COULD]
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useUserContext } from "./UserContextProvider";
import type { AssistantMode } from "../../lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  error?: boolean;
};

type Props = {
  /** The current assistant mode (set by IntentChips) */
  mode: AssistantMode;
  /** Called with the full response text after streaming completes */
  onAssistantReply?: (text: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWelcomeMessage(language: string, role: string): string {
  const volunteer = role === "volunteer";
  switch (language) {
    case "es":
      return volunteer
        ? "👋 ¡Hola! Modo voluntario activo. Puedo ayudarte a asistir a los fanáticos con direcciones e información."
        : "👋 ¡Hola! Soy Stadium Copilot. Puedo ayudarte con direcciones, transporte, accesibilidad y más. ¿En qué puedo ayudarte?";
    case "fr":
      return volunteer
        ? "👋 Bonjour ! Mode bénévole actif. Je peux vous aider à guider les supporters avec des directions et des informations."
        : "👋 Bonjour ! Je suis Stadium Copilot. Je peux vous aider avec les directions, le transport, l'accessibilité et plus. Comment puis-je vous aider ?";
    default:
      return volunteer
        ? "👋 Hi! Volunteer mode active. I can help you assist fans with directions, transport, and venue information."
        : "👋 Hi! I'm Stadium Copilot. I can help you with directions, transport, accessibility, and more. What can I help you with today?";
  }
}

function getPlaceholder(mode: AssistantMode, language: string): string {
  if (language === "es") return "Escribe tu pregunta…  (Enter para enviar, Shift+Enter nueva línea)";
  if (language === "fr") return "Posez votre question…  (Entrée pour envoyer)";
  switch (mode) {
    case "transport":
      return "Ask about trains, buses, rideshare pick-up…";
    case "translation":
      return "Type a message to translate for a fan…";
    case "sustainability":
      return "Ask about recycling, water refills, or green tips…";
    default:
      return "Ask about directions, facilities, accessibility…";
  }
}

// ---------------------------------------------------------------------------
// Streaming cursor
// ---------------------------------------------------------------------------

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-[7px] h-[14px] ml-0.5 bg-blue-400/70
                 align-text-bottom animate-pulse rounded-[2px]"
    />
  );
}

// ---------------------------------------------------------------------------
// Thinking indicator (shown while waiting for first token — Task 7.6)
// ---------------------------------------------------------------------------

function ThinkingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in" aria-label="Assistant is thinking">
      <div
        className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-700
                   flex items-center justify-center text-white text-sm mr-2 mt-1 shrink-0"
        aria-hidden="true"
      >
        🏟
      </div>
      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatPanel({ mode, onAssistantReply }: Props) {
  const { userContext } = useUserContext();
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: getWelcomeMessage(userContext.language, userContext.role),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  // True while we've sent the request but haven't received any tokens yet
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to latest message or when thinking state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Update welcome message when language or role changes
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === "welcome"
          ? { ...m, text: getWelcomeMessage(userContext.language, userContext.role) }
          : m
      )
    );
  }, [userContext.language, userContext.role]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now() + 1}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: trimmed },
      { id: assistantMsgId, role: "assistant", text: "", streaming: true },
    ]);
    setInput("");
    setIsStreaming(true);
    setIsThinking(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          userMessage: trimmed,
          userContext,
          mode,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let firstTokenReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        // Hide thinking indicator as soon as first token arrives
        if (!firstTokenReceived) {
          setIsThinking(false);
          firstTokenReceived = true;
        }
        const snapshot = fullText;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, text: snapshot } : m
          )
        );
      }

      // Mark streaming complete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      );
      onAssistantReply?.(fullText);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      console.error("[ChatPanel] fetch error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: "I'm having trouble reaching the assistant right now. Please try again in a moment.",
                streaming: false,
                error: true,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isVolunteer = userContext.role === "volunteer";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full min-h-0" id="chat-panel">
      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => {
          // Skip empty streaming messages — ThinkingIndicator covers this state
          if (msg.streaming && msg.text === "") return null;
          return (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            {/* Assistant avatar */}
            {msg.role === "assistant" && (
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-700
                           flex items-center justify-center text-white text-sm mr-2 mt-1 shrink-0 shadow-md"
                aria-hidden="true"
              >
                🏟
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/30"
                  : msg.error
                  ? "bg-red-900/25 border border-red-500/30 text-red-300 rounded-tl-sm"
                  : "bg-white/[0.04] border border-white/[0.07] text-gray-200 rounded-tl-sm"
              }`}
            >
              {/* Volunteer translation header */}
              {isVolunteer && msg.role === "assistant" && !msg.error && (
                <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span>🤝</span> Volunteer assist response
                </div>
              )}

              {msg.text}
              {msg.streaming && <StreamingCursor />}
            </div>
          </div>
          );
        })}
        {/* Thinking indicator — shown while waiting for first token (Task 7.6) */}
        {isThinking && <ThinkingIndicator />}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder(mode, userContext.language)}
            disabled={isStreaming}
            rows={1}
            aria-label="Type your message"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm
                       text-white placeholder-gray-600 outline-none resize-none max-h-32 overflow-auto
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            style={{ lineHeight: "1.5" }}
          />
          <button
            id="chat-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            aria-label="Send message"
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-white flex items-center justify-center
                       transition-all duration-150 shadow-lg shadow-blue-900/30 shrink-0"
          >
            {isStreaming ? (
              <span className="text-xs animate-pulse" aria-hidden="true">
                ···
              </span>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5 text-center select-none">
          AI responses are grounded in venue data · Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
