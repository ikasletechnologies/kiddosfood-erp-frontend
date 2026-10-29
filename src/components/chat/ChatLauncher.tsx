"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useChat } from "@/context/ChatContext";

/** Opens the existing authorised HQ/franchise chat, sharing its unread state. */
export default function ChatLauncher() {
  const { enabled, role, totalUnread } = useChat();
  const pathname = usePathname();
  if (!enabled || (role !== "SUPER_ADMIN" && role !== "FRANCHISE_ADMIN") || pathname === "/chat") return null;
  return (
    <Link href="/chat" aria-label={totalUnread ? `Open chat, ${totalUnread} unread messages` : "Open chat"}
      title={role === "FRANCHISE_ADMIN" ? "Chat with Super Admin" : "Franchise Chat"}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#F58220] text-white shadow-lg hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 print:hidden">
      <MessageCircle size={24} aria-hidden="true" />
      {totalUnread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5">{totalUnread > 99 ? "99+" : totalUnread}</span>}
    </Link>
  );
}
