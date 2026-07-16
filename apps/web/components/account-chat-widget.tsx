"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  MessageCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type { SupportedLocale } from "@ai-radar/shared";
import { trackAnalyticsEvent } from "@/components/analytics-events";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  localOnly?: boolean;
};

const SESSION_STORAGE_KEY = "llmvisio_account_chat_session_id";
const ANONYMOUS_STORAGE_KEY = "llmvisio_account_chat_anonymous_id";

export function AccountChatWidget({ locale }: { locale: SupportedLocale }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content:
        locale === "en"
          ? "Hi, I am the LLMVisio support bot. Ask me about audits, pricing, reports, MCP access or your account."
          : "Zivjo, sem LLMVisio support bot. Vprasaj me o pregledih, ceniku, porocilih, MCP dostopu ali svojem racunu.",
      localOnly: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!ignore) setIsAuthenticated(Boolean(data?.user));
      })
      .catch(() => {
        if (!ignore) setIsAuthenticated(false);
      });

    const savedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSessionId) setSessionId(savedSessionId);
    setAnonymousId(ensureAnonymousId());

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  const brandId = useMemo(() => currentBrandId(pathname), [pathname]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isPending) return;

    const localUserMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content,
      localOnly: true,
    };
    const pendingMessage: ChatMessage = {
      id: "pending",
      role: "assistant",
      content: locale === "en" ? "Thinking..." : "Razmisljam...",
      pending: true,
      localOnly: true,
    };

    setMessages((current) => [...current, localUserMessage, pendingMessage]);
    setInput("");
    setIsPending(true);
    setError(null);
    const currentAnonymousId = anonymousId ?? ensureAnonymousId();
    setAnonymousId(currentAnonymousId);
    trackAnalyticsEvent("ai_chat_message_sent", {
      has_session: Boolean(sessionId),
      has_brand_context: Boolean(brandId),
      authenticated: isAuthenticated,
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: sessionId ?? undefined,
          brandId: brandId ?? undefined,
          anonymousId: currentAnonymousId,
          locale,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Chat failed",
        );
      }

      const nextSessionId = String(data.session?.id ?? "");
      if (nextSessionId) {
        setSessionId(nextSessionId);
        window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
      }

      const assistantMessage: ChatMessage = {
        id: String(data.message?.id ?? `assistant-${Date.now()}`),
        role: "assistant",
        content: String(data.message?.content ?? ""),
      };

      setMessages((current) =>
        current.map((message) =>
          message.id === "pending" ? assistantMessage : message,
        ),
      );
      trackAnalyticsEvent("ai_chat_response_generated", {
        has_brand_context: Boolean(brandId),
        authenticated: isAuthenticated,
        latency_ms:
          typeof data.usage?.latencyMs === "number"
            ? data.usage.latencyMs
            : undefined,
      });
    } catch (submitError) {
      setMessages((current) =>
        current.filter((message) => message.id !== "pending"),
      );
      setError(
        submitError instanceof Error
          ? submitError.message
          : locale === "en"
            ? "The assistant is not available right now."
            : "Asistent trenutno ni na voljo.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function sendFeedback(messageId: string, rating: 1 | -1) {
    if (!sessionId || messageId === "welcome") return;
    const currentAnonymousId = anonymousId ?? ensureAnonymousId();
    setAnonymousId(currentAnonymousId);
    trackAnalyticsEvent("ai_chat_feedback_submitted", {
      rating,
      authenticated: isAuthenticated,
    });
    await fetch("/api/chat/feedback", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        messageId,
        rating,
        anonymousId: currentAnonymousId,
      }),
    }).catch(() => null);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section className="flex h-[min(34rem,calc(100vh-7rem))] w-[min(calc(100vw-2.5rem),24rem)] flex-col overflow-hidden rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-5 w-5 shrink-0 text-primary" />
              <div className="truncate text-sm font-semibold">LLMVisio AI</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={locale === "en" ? "Close chat" : "Zapri chat"}
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-secondary/20 px-3 py-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={[
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-md px-3 py-2 text-sm leading-6",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-white",
                    message.pending
                      ? "animate-pulse text-muted-foreground"
                      : "",
                  ].join(" ")}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.role === "assistant" &&
                    !message.pending &&
                    !message.localOnly && (
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label={locale === "en" ? "Helpful" : "Uporabno"}
                          onClick={() => sendFeedback(message.id, 1)}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label={
                            locale === "en" ? "Not helpful" : "Ni uporabno"
                          }
                          onClick={() => sendFeedback(message.id, -1)}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                </div>
              </div>
            ))}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={submitMessage} className="border-t bg-white p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isPending}
                placeholder={
                  locale === "en" ? "Ask support..." : "Vprasaj podporo..."
                }
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isPending || !input.trim()}
                aria-label={locale === "en" ? "Send" : "Poslji"}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </section>
      )}

      <Button
        type="button"
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        aria-label={locale === "en" ? "Open AI chat" : "Odpri AI chat"}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) {
            trackAnalyticsEvent("ai_chat_opened", {
              has_brand_context: Boolean(brandId),
              authenticated: isAuthenticated,
            });
          }
        }}
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}

function ensureAnonymousId() {
  const existing = window.localStorage.getItem(ANONYMOUS_STORAGE_KEY);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(ANONYMOUS_STORAGE_KEY, next);
  return next;
}

function currentBrandId(pathname: string | null) {
  const parts = (pathname ?? "").split("/").filter(Boolean);
  const appIndex = parts.indexOf("app");
  if (appIndex === -1) return null;
  if (parts[appIndex + 1] !== "brands") return null;
  return parts[appIndex + 2] ?? null;
}
