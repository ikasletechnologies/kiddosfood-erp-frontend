"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { clsx } from "clsx";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, Loader2, RotateCw, SendHorizontal, WifiOff } from "lucide-react";
import { chatApi, ChatMessage, CHAT_MAX_LENGTH } from "@/lib/api";
import { useChat } from "@/context/ChatContext";

type UiMessage = ChatMessage & { status?: "pending" | "failed"; error?: string };

interface ChatThreadProps {
  conversationId: string;
  title: string;
  subtitle?: string;
  avatarLabel: string;
  onBack?: () => void;
}

const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM yyyy");
};

/** Adds or replaces messages by id / clientMessageId, keeping time order. */
function merge(list: UiMessage[], incoming: UiMessage[]) {
  const next = [...list];
  for (const m of incoming) {
    const i = next.findIndex((x) => x.id === m.id || (!!m.clientMessageId && x.clientMessageId === m.clientMessageId));
    if (i >= 0) next[i] = m;
    else next.push(m);
  }
  // Unsaved (pending/failed) messages stay at the bottom.
  return next.sort((a, b) => {
    if (!!a.status !== !!b.status) return a.status ? 1 : -1;
    return a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);
  });
}

export default function ChatThread({ conversationId, title, subtitle, avatarLabel, onBack }: ChatThreadProps) {
  const { connected, role, userId, send, markRead, setActiveConversation, subscribe } = useChat();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const messagesRef = useRef<UiMessage[]>([]);
  messagesRef.current = messages;

  const isMine = useCallback((m: ChatMessage) => m.senderRole === role, [role]);

  const markReadIfVisible = useCallback(() => {
    if (document.visibilityState === "visible") markRead(conversationId);
  }, [conversationId, markRead]);

  // Initial load whenever the conversation changes.
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setHasMore(false);
    setPeerLastReadAt(null);
    setLoadError(null);
    setLoading(true);
    stickToBottom.current = true;
    setActiveConversation(conversationId);

    chatApi
      .getMessages(conversationId, { limit: 30 })
      .then(({ data }) => {
        if (cancelled) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
        setPeerLastReadAt(data.peerLastReadAt);
        markReadIfVisible();
      })
      .catch(() => !cancelled && setLoadError("Could not load this conversation."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      setActiveConversation(null);
    };
  }, [conversationId, setActiveConversation, markReadIfVisible]);

  // Live events.
  useEffect(() => {
    const offMessage = subscribe("message", ({ conversationId: cid, message }) => {
      if (cid !== conversationId) return;
      const el = scrollRef.current;
      stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120 || message.senderUserId === userId;
      setMessages((prev) => merge(prev, [message]));
      if (message.senderRole !== role) markReadIfVisible();
    });
    const offRead = subscribe("read", (e) => {
      if (e.conversationId !== conversationId || e.role === role) return;
      setPeerLastReadAt((prev) => (!prev || e.lastReadAt > prev ? e.lastReadAt : prev));
    });
    // After a reconnect, fetch whatever arrived while offline.
    const offReconnect = subscribe("reconnect", async () => {
      const lastSaved = [...messagesRef.current].reverse().find((m) => !m.status);
      try {
        const { data } = await chatApi.getMessages(conversationId, lastSaved ? { after: lastSaved.createdAt } : { limit: 30 });
        setMessages((prev) => merge(prev, data.messages));
        setPeerLastReadAt(data.peerLastReadAt);
        markReadIfVisible();
      } catch {
        /* next reconnect will retry */
      }
    });
    const onVisible = () => document.visibilityState === "visible" && markRead(conversationId);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offMessage();
      offRead();
      offReconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conversationId, role, userId, subscribe, markRead, markReadIfVisible]);

  // Keep the view pinned to the bottom for new messages, and keep position when older ones load.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current.find((m) => !m.status);
    if (!first || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const { data } = await chatApi.getMessages(conversationId, { before: first.id, limit: 30 });
      const el = scrollRef.current;
      restoreFrom.current = el ? el.scrollHeight - el.scrollTop : null;
      stickToBottom.current = false;
      setMessages((prev) => merge(prev, data.messages));
      setHasMore(data.hasMore);
    } catch {
      /* user can scroll up again */
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder]);

  const deliver = useCallback(
    async (pending: UiMessage) => {
      try {
        const saved = await send(conversationId, pending.content, pending.clientMessageId!);
        setMessages((prev) => merge(prev, [saved]));
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) => (m.clientMessageId === pending.clientMessageId ? { ...m, status: "failed", error: err?.message } : m)),
        );
      }
    },
    [conversationId, send],
  );

  const submit = () => {
    const content = draft.trim();
    if (!content || content.length > CHAT_MAX_LENGTH) return;
    const clientMessageId = newClientId();
    const pending: UiMessage = {
      id: `pending-${clientMessageId}`,
      conversationId,
      senderUserId: userId,
      senderRole: role!,
      senderName: "You",
      messageType: "TEXT",
      content,
      clientMessageId,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      status: "pending",
    };
    stickToBottom.current = true;
    setMessages((prev) => merge(prev, [pending]));
    setDraft("");
    inputRef.current?.focus();
    deliver(pending);
  };

  const retry = (m: UiMessage) => {
    const pending = { ...m, status: "pending" as const, error: undefined };
    setMessages((prev) => merge(prev, [pending]));
    deliver(pending); // same clientMessageId → server dedupes if the first attempt did land
  };

  const tooLong = draft.length > CHAT_MAX_LENGTH;
  const canSend = !!draft.trim() && !tooLong;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#0f1117]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-white/5 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            aria-label="Back to conversations"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#F58220] flex items-center justify-center font-bold text-sm shrink-0">
          {avatarLabel}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
        </div>
        {!connected && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400" title="Reconnecting…">
            <WifiOff size={14} /> Offline
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => e.currentTarget.scrollTop < 80 && loadOlder()}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4 bg-slate-50 dark:bg-[#0b0c10]"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#F58220]" />
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500">{loadError}</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-400 px-6">
            No messages yet. Say hello 👋
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-3">
                <button
                  type="button"
                  onClick={loadOlder}
                  className="text-xs font-semibold text-slate-500 hover:text-[#F58220] flex items-center gap-1"
                >
                  {loadingOlder && <Loader2 size={12} className="animate-spin" />} Load earlier messages
                </button>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const mine = isMine(m);
              const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
              const showName = m.senderUserId !== userId && (!prev || prev.senderUserId !== m.senderUserId || showDay);
              const read = mine && !m.status && !!peerLastReadAt && peerLastReadAt >= m.createdAt;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex justify-center my-3">
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-white/5 text-slate-500 shadow-sm">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={clsx("flex mb-1.5", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={clsx(
                        "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm",
                        mine
                          ? "bg-orange-100 dark:bg-orange-900/40 text-slate-900 dark:text-orange-50 rounded-br-md"
                          : "bg-white dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 rounded-bl-md",
                        m.status === "failed" && "ring-1 ring-red-400",
                      )}
                    >
                      {showName && (
                        <p className={clsx("text-[11px] font-bold mb-0.5", mine ? "text-orange-700 dark:text-orange-300" : "text-[#F58220]")}>
                          {m.senderName}
                        </p>
                      )}
                      {/* Rendered as text — React escapes it; never use innerHTML here. */}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {m.deletedAt ? <span className="italic text-slate-400">Message deleted</span> : m.content}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{format(new Date(m.createdAt), "h:mm a")}</span>
                        {mine && m.status === "pending" && <Clock size={12} aria-label="Sending" />}
                        {mine && m.status === "failed" && <AlertCircle size={12} className="text-red-500" aria-label="Not sent" />}
                        {mine && !m.status && !read && <Check size={13} aria-label="Sent" />}
                        {mine && read && <CheckCheck size={13} className="text-sky-500" aria-label="Read" />}
                      </div>
                    </div>
                  </div>
                  {m.status === "failed" && (
                    <div className="flex justify-end items-center gap-2 mb-2 text-[11px] text-red-500">
                      <span className="truncate max-w-[60%]">{m.error || "Not sent"}</span>
                      <button type="button" onClick={() => retry(m)} className="flex items-center gap-1 font-semibold hover:underline">
                        <RotateCw size={11} /> Retry
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200/70 dark:border-white/5 px-3 sm:px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Type a message"
            aria-label="Message"
            className="flex-1 resize-none max-h-32 min-h-[42px] rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className="h-[42px] w-[42px] shrink-0 rounded-full bg-[#F58220] text-white flex items-center justify-center shadow-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
        {draft.length > CHAT_MAX_LENGTH - 200 && (
          <p className={clsx("mt-1 text-right text-[11px]", tooLong ? "text-red-500" : "text-slate-400")}>
            {draft.length}/{CHAT_MAX_LENGTH}
          </p>
        )}
      </div>
    </div>
  );
}
