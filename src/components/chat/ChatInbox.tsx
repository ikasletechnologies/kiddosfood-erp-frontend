"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { clsx } from "clsx";
import { Loader2, Search, Store } from "lucide-react";
import { chatApi, ChatInboxItem } from "@/lib/api";
import { useChat } from "@/context/ChatContext";

interface ChatInboxProps {
  selectedFranchiseId: string | null;
  onSelect: (item: ChatInboxItem) => void;
}

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yy");
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Super Admin's franchise list: search, latest preview, unread, live reordering. */
export default function ChatInbox({ selectedFranchiseId, onSelect }: ChatInboxProps) {
  const { subscribe, unreadByConversation } = useChat();
  const [items, setItems] = useState<ChatInboxItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    try {
      const { data } = await chatApi.getInbox(term || undefined);
      setItems(data.items);
      setError(null);
    } catch {
      setError("Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  // Live preview + reorder. Unknown franchise (e.g. outside the current search) → refetch.
  useEffect(() => {
    const offMessage = subscribe("message", ({ franchiseId, conversationId, message }) => {
      setItems((prev) => {
        const i = prev.findIndex((x) => x.franchiseId === franchiseId);
        if (i < 0) {
          load(search.trim());
          return prev;
        }
        const updated: ChatInboxItem = {
          ...prev[i],
          conversationId,
          lastMessageAt: message.createdAt,
          lastMessage: { preview: message.content.slice(0, 120), senderRole: message.senderRole, createdAt: message.createdAt },
        };
        return [updated, ...prev.slice(0, i), ...prev.slice(i + 1)];
      });
    });
    const offReconnect = subscribe("reconnect", () => load(search.trim()));
    return () => {
      offMessage();
      offReconnect();
    };
  }, [subscribe, load, search]);

  // Unread counts always come from ChatContext (kept live by socket events),
  // so the list and the sidebar badge never disagree.
  const unreadFor = useMemo(
    () => (item: ChatInboxItem) => (item.conversationId ? unreadByConversation[item.conversationId] || 0 : 0),
    [unreadByConversation],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#0f1117]">
      <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 dark:border-white/5 shrink-0">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">Franchise Chats</h2>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search franchises"
            aria-label="Search franchises"
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-[#F58220]" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-10 px-4">{error}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Store size={28} />
            <p className="text-sm">{search ? "No franchises match your search." : "No franchises yet."}</p>
          </div>
        ) : (
          items.map((item) => {
            const unread = unreadFor(item);
            const selected = item.franchiseId === selectedFranchiseId;
            return (
              <button
                key={item.franchiseId}
                type="button"
                onClick={() => onSelect(item)}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-white/[0.03] transition-colors",
                  selected ? "bg-orange-50/90 dark:bg-orange-950/30" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                )}
              >
                <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#F58220] flex items-center justify-center font-bold text-sm shrink-0">
                  {initials(item.franchiseName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.franchiseName}</p>
                    {item.lastMessage && (
                      <span className={clsx("text-[11px] shrink-0", unread ? "text-[#F58220] font-semibold" : "text-slate-400")}>
                        {timeLabel(item.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={clsx("text-xs truncate", unread ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-500 dark:text-slate-400")}>
                      {item.lastMessage
                        ? `${item.lastMessage.senderRole === "SUPER_ADMIN" ? "You: " : ""}${item.lastMessage.preview}`
                        : item.location || "No messages yet"}
                    </p>
                    {unread > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#F58220] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
