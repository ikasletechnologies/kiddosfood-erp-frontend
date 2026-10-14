"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { MessageCircle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { chatApi, ChatMessage, ChatRole } from "@/lib/api";

/**
 * Super Admin ⇄ Franchise chat: one authenticated socket on the backend's
 * `/chat` namespace per signed-in user, plus unread counts for the sidebar
 * badge and toasts. Room membership is decided by the server from the user's
 * token — the client never asks to join a room.
 *
 * Separate from NotificationContext's socket (default namespace) on purpose,
 * so existing ERP notifications are unaffected.
 */

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
const ACK_TIMEOUT_MS = 10_000;

export type ChatReadEvent = { conversationId: string; franchiseId: string; userId: string; role: ChatRole; lastReadAt: string };
type ChatEvents = {
  message: { conversationId: string; franchiseId: string; message: ChatMessage };
  read: ChatReadEvent;
  reconnect: void;
};
type Listener<K extends keyof ChatEvents> = (payload: ChatEvents[K]) => void;

interface ChatContextType {
  enabled: boolean;
  connected: boolean;
  role: ChatRole | null;
  userId: string | null;
  totalUnread: number;
  unreadByConversation: Record<string, number>;
  /** Persist + deliver a message; resolves with the saved message. */
  send: (conversationId: string, content: string, clientMessageId: string) => Promise<ChatMessage>;
  markRead: (conversationId: string) => void;
  /** The conversation currently on screen (suppresses unread/toasts for it). */
  setActiveConversation: (conversationId: string | null) => void;
  subscribe: <K extends keyof ChatEvents>(event: K, fn: Listener<K>) => () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const normalizeRole = (user: any): ChatRole | null => {
  const raw = String(user?.role?.name ?? user?.role ?? "").toUpperCase();
  return raw === "SUPER_ADMIN" || raw === "FRANCHISE_ADMIN" ? raw : null;
};

const errorMessage = (err: any) =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || "Message could not be sent";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const role = normalizeRole(user);
  const userId = (user as any)?.id ?? null;
  const enabled = !!userId && !!role;

  const [connected, setConnected] = useState(false);
  const [unreadByConversation, setUnread] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const listeners = useRef(new Map<keyof ChatEvents, Set<Listener<any>>>());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const fire = useCallback(<K extends keyof ChatEvents>(event: K, payload: ChatEvents[K]) => {
    listeners.current.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error("[Chat] listener failed", e);
      }
    });
  }, []);

  const subscribe = useCallback(<K extends keyof ChatEvents>(event: K, fn: Listener<K>) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event)!.add(fn);
    return () => {
      listeners.current.get(event)?.delete(fn);
    };
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await chatApi.getUnread();
      setUnread(data.byConversation || {});
    } catch {
      /* badge is best-effort */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Badge works even if the socket can't connect (e.g. websockets blocked).
    refreshUnread();

    const socket = io(`${SOCKET_URL}/chat`, {
      // Read on every (re)connect so a refreshed access token is picked up.
      auth: (cb) => cb({ token: localStorage.getItem("access_token") || "" }),
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;
    let everConnected = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // The server rejects expired tokens (handshake or mid-session). Any REST
    // call refreshes the token via the axios interceptor; then reconnect.
    const reauthAndReconnect = () => {
      if (retryTimer) return;
      retryTimer = setTimeout(async () => {
        retryTimer = null;
        await refreshUnread();
        if (localStorage.getItem("access_token") && !socket.connected) socket.connect();
      }, 1500);
    };

    socket.on("connect", () => {
      setConnected(true);
      refreshUnread();
      if (everConnected) fire("reconnect", undefined);
      everConnected = true;
    });
    socket.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io server disconnect") reauthAndReconnect();
    });
    socket.on("connect_error", (err) => {
      if (err.message === "UNAUTHORIZED") reauthAndReconnect();
    });

    socket.on("chat:message", (payload: ChatEvents["message"]) => {
      const { message, conversationId } = payload;
      const fromOtherSide = message.senderRole !== role && message.senderUserId !== userId;
      const onScreen = activeRef.current === conversationId && document.visibilityState === "visible";
      if (fromOtherSide && !onScreen) {
        setUnread((prev) => ({ ...prev, [conversationId]: (prev[conversationId] || 0) + 1 }));
        if (pathnameRef.current !== "/chat") {
          const title = role === "SUPER_ADMIN" ? message.senderName : "Kiddos HQ";
          toast(
            (t) => (
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  toast.dismiss(t.id);
                  router.push(role === "SUPER_ADMIN" ? `/chat?f=${payload.franchiseId}` : "/chat");
                }}
              >
                <span className="block text-xs font-bold text-slate-900">{title}</span>
                <span className="block text-xs text-slate-600 line-clamp-2 break-words">{message.content}</span>
              </button>
            ),
            { id: `chat-${conversationId}`, icon: <MessageCircle size={18} className="text-[#F58220]" />, duration: 5000 },
          );
        }
      }
      fire("message", payload);
    });

    socket.on("chat:read", (payload: ChatReadEvent) => {
      if (payload.userId === userId) setUnread((prev) => ({ ...prev, [payload.conversationId]: 0 }));
      fire("read", payload);
    });

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setUnread({});
    };
  }, [enabled, role, userId, fire, refreshUnread, router]);

  const send = useCallback(async (conversationId: string, content: string, clientMessageId: string) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      let res: any = null;
      try {
        res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck("chat:send", { conversationId, content, clientMessageId });
      } catch {
        // No ack in time — retry over REST below.
      }
      if (res?.ok) return res.message as ChatMessage;
      // Validation / permission / rate-limit errors are final; expired
      // sessions and server errors fall through to REST.
      if (res && res.status !== 401 && res.status < 500) throw new Error(res.error);
    }
    // REST fallback (also refreshes an expired token). Same clientMessageId, so
    // a message the socket did save is returned instead of duplicated.
    try {
      const { data } = await chatApi.sendMessage(conversationId, content, clientMessageId);
      return data.message;
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  }, []);

  const markRead = useCallback((conversationId: string) => {
    setUnread((prev) => (prev[conversationId] ? { ...prev, [conversationId]: 0 } : prev));
    const socket = socketRef.current;
    if (socket?.connected) socket.emit("chat:read", { conversationId }, () => undefined);
    else chatApi.markRead(conversationId).catch(() => undefined);
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeRef.current = conversationId;
  }, []);

  const totalUnread = useMemo(
    () => Object.values(unreadByConversation).reduce((sum, n) => sum + (n || 0), 0),
    [unreadByConversation],
  );

  const value = useMemo<ChatContextType>(
    () => ({
      enabled,
      connected,
      role,
      userId,
      totalUnread,
      unreadByConversation,
      send,
      markRead,
      setActiveConversation,
      subscribe,
    }),
    [enabled, connected, role, userId, totalUnread, unreadByConversation, send, markRead, setActiveConversation, subscribe],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
