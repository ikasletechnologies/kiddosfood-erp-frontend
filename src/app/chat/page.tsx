"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Loader2, MessagesSquare } from "lucide-react";
import { chatApi, ChatConversation, ChatInboxItem } from "@/lib/api";
import { useChat } from "@/context/ChatContext";
import ChatInbox, { initials } from "@/components/chat/ChatInbox";
import ChatThread from "@/components/chat/ChatThread";

// Fills the main area under the 64px header, minus AppShell's padding.
const FULL_HEIGHT = "h-[calc(100vh-64px-2rem)] sm:h-[calc(100vh-64px-2.5rem)] lg:h-[calc(100vh-64px-3rem)]";
const PANEL = "rounded-2xl border border-slate-200/70 dark:border-white/5 overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)]";

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{children}</div>;
}

/** Super Admin: WhatsApp-style inbox (left) + selected franchise thread (right). */
function SuperAdminChat() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedFranchiseId = searchParams.get("f");
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection lives in the URL (?f=<franchiseId>) so refresh / toast links reopen it.
  useEffect(() => {
    if (!selectedFranchiseId) {
      setConversation(null);
      return;
    }
    let cancelled = false;
    setOpening(true);
    setError(null);
    chatApi
      .openForFranchise(selectedFranchiseId)
      .then(({ data }) => !cancelled && setConversation(data.conversation))
      .catch(() => !cancelled && setError("Could not open this conversation."))
      .finally(() => !cancelled && setOpening(false));
    return () => {
      cancelled = true;
    };
  }, [selectedFranchiseId]);

  const select = useCallback(
    (item: ChatInboxItem) => router.replace(`${pathname}?f=${item.franchiseId}`, { scroll: false }),
    [router, pathname],
  );

  return (
    <div className={clsx(FULL_HEIGHT, PANEL, "flex")}>
      <div
        className={clsx(
          "w-full md:w-[340px] lg:w-[380px] shrink-0 md:border-r border-slate-200/70 dark:border-white/5",
          selectedFranchiseId && "hidden md:block",
        )}
      >
        <ChatInbox selectedFranchiseId={selectedFranchiseId} onSelect={select} />
      </div>
      <div className={clsx("flex-1 min-w-0", !selectedFranchiseId && "hidden md:block")}>
        {!selectedFranchiseId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#0b0c10] text-slate-400 px-6 text-center">
            <MessagesSquare size={40} className="text-[#F58220]/70" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Select a franchise to start chatting</p>
            <p className="text-xs">Each franchise has its own private conversation with HQ.</p>
          </div>
        ) : error ? (
          <Centered>{error}</Centered>
        ) : opening || !conversation ? (
          <Centered>
            <Loader2 size={22} className="animate-spin text-[#F58220]" />
          </Centered>
        ) : (
          <ChatThread
            conversationId={conversation.id}
            title={conversation.franchiseName}
            subtitle="Franchise conversation"
            avatarLabel={initials(conversation.franchiseName)}
            onBack={() => router.replace(pathname, { scroll: false })}
          />
        )}
      </div>
    </div>
  );
}

/** Franchise user: only their own franchise's conversation with HQ. */
function FranchiseChat() {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chatApi
      .getMine()
      .then(({ data }) => setConversation(data.conversation))
      .catch(() => setError("Chat is unavailable right now."));
  }, []);

  return (
    <div className={clsx(FULL_HEIGHT, PANEL, "max-w-4xl mx-auto")}>
      {error ? (
        <Centered>{error}</Centered>
      ) : !conversation ? (
        <Centered>
          <Loader2 size={22} className="animate-spin text-[#F58220]" />
        </Centered>
      ) : (
        <ChatThread conversationId={conversation.id} title="Kiddos HQ Support" subtitle="Super Admin" avatarLabel="HQ" />
      )}
    </div>
  );
}

function ChatPage() {
  const { role } = useChat();
  if (role === "SUPER_ADMIN") return <SuperAdminChat />;
  if (role === "FRANCHISE_ADMIN") return <FranchiseChat />;
  return <Centered>Chat is not available for your account.</Centered>;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}
