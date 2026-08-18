"use client";

import {
  Menu as MenuIcon,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  Info,
  Search,
  X,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  ChefHat,
  Store,
  Sun,
  Moon,
  ExternalLink,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { SUPER_ADMIN_SIDEBAR, menuItems } from "@/config/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useNotification, Notification } from "@/context/NotificationContext";
import Link from "next/link";


function NIcon({ type }: { type: Notification["type"] }) {
  if (type === "success") return <CheckCircle size={14} className="text-emerald-500 shrink-0" />;
  if (type === "alert")   return <AlertTriangle size={14} className="text-red-500 shrink-0" />;
  if (type === "warning") return <AlertCircle size={14} className="text-amber-500 shrink-0" />;
  return <Info size={14} className="text-blue-500 shrink-0" />;
}

function HBtn({
  children, title, onClick, badge,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
  badge?: number | string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="relative p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-primary/5 dark:hover:bg-white/5 hover:text-primary transition-all duration-150"
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f1117] leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = q
    ? menuItems.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()))
    : menuItems;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [q]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { 
      if (e.key === "Escape") onClose(); 
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        router.push(filtered[selectedIndex].href);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, filtered, selectedIndex, router]);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/5">
          <Search size={16} className="text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menus, pos, orders, settings…"
            className="flex-1 text-sm text-gray-900 dark:text-white bg-transparent outline-none placeholder:text-gray-400"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-gray-400 border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <div className="max-h-64 overflow-y-auto hide-scrollbar py-1">
          {filtered.length > 0 ? (
            filtered.map((item, index) => {
              const Icon = item.icon || Search;
              return (
                <button
                  key={item.label + item.href}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                    index === selectedIndex 
                      ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground" 
                      : "text-gray-700 dark:text-slate-300 hover:bg-primary/5 dark:hover:bg-white/5"
                  )}
                >
                  <Icon size={13} className={clsx("shrink-0", index === selectedIndex ? "text-primary dark:text-primary-foreground" : "text-gray-300 dark:text-slate-600")} />
                  {item.label}
                </button>
              );
            })
          ) : (
            <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              No results for &quot;{q}&quot;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RefrensHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toggleCollapsed, toggleMobileOpen } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  const [showSearch,        setShowSearch]        = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile,       setShowProfile]       = useState(false);
  
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotification();

  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const initials =
    user?.fullName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "NX";

  const getPageTitle = () => {
    for (const section of SUPER_ADMIN_SIDEBAR) {
      for (const item of section.items) {
        if (item.href === pathname) return item.label;
        if (item.children) {
          const child = item.children.find((c) => c.href === pathname);
          if (child) return child.label;
        }
      }
    }
    // Fallback for special cases or home
    if (pathname === "/") return "Overview";
    return "";
  };

  const pageTitle = getPageTitle();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (pathname === "/login") return null;

  return (
    <>
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}

      <header className="w-full h-14 bg-white dark:bg-[#0f1117] border-b border-slate-100 dark:border-white/5 flex items-center px-4 gap-3 sticky top-0 z-40 shadow-sm">

        {/* ── Left: Hamburger + Logo ──────────────────── */}
        <button
          onClick={toggleMobileOpen}
          className="lg:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
          aria-label="Toggle Menu"
        >
          <MenuIcon size={20} />
        </button>

        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex p-2 -ml-2 rounded-xl text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
          title="Toggle Sidebar"
        >
          <MenuIcon size={20} />
        </button>

        {/* Dynamic Page Title */}
        {pageTitle && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
            <h1 className="text-[15px] font-black text-gray-900 dark:text-white tracking-tight uppercase">
              {pageTitle}
            </h1>
          </div>
        )}


        <div className="flex-1" />

        {/* ── Right Actions ──────────────────────────── */}
        <div className="flex items-center gap-1">

          {/* Search */}
          <HBtn title="Omni Search (Ctrl+K)" onClick={() => setShowSearch(true)}>
            <Search size={18} strokeWidth={1.8} />
          </HBtn>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <HBtn
              title="System Alerts"
              badge={unreadCount > 0 ? unreadCount : undefined}
              onClick={() => { setShowNotifications((v) => !v); setShowProfile(false); }}
            >
              <Bell size={18} strokeWidth={1.8} />
            </HBtn>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#0f1117] rounded-2xl border border-slate-100 dark:border-white/10 shadow-2xl shadow-black/10 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 dark:border-white/5">
                  <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">
                    Telemetry
                    {unreadCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[10px] font-black uppercase text-indigo-500 hover:underline">
                      Acknowledge All
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto hide-scrollbar divide-y divide-slate-50 dark:divide-white/5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.link) {
                          router.push(n.link);
                          setShowNotifications(false);
                        }
                      }}
                      className={clsx(
                        "group w-full flex items-start gap-4 px-4 py-4 text-left cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors",
                        !n.read && "bg-slate-50/40 dark:bg-indigo-900/5"
                      )}
                    >
                      <div className="mt-0.5"><NIcon type={n.type} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight uppercase tracking-tight flex items-center justify-between">
                          {n.title}
                          {n.link && <ExternalLink size={10} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 italic leading-snug">{n.message}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 font-black uppercase tracking-tighter flex items-center gap-1.5">
                          {n.time}
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Bell size={24} className="mx-auto text-gray-300 dark:text-white/10 mb-2" />
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">No Notifications</p>
                    </div>
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-slate-50 dark:border-white/5">
                  <a href="/alerts" className="w-full text-[10px] text-indigo-500 font-black uppercase hover:underline text-center block tracking-widest">
                    All System Logs →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar */}
          <div className="relative ml-1" ref={profileRef}>
            <button
              onClick={() => { setShowProfile((v) => !v); setShowNotifications(false); }}
              className="flex items-center gap-1.5 pl-2 border-l border-slate-100 dark:border-white/5 group"
              aria-label="Account Settings"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-black text-sm group-hover:scale-105 transition-all ring-2 ring-white dark:ring-[#0f1117] shadow-md uppercase">
                {initials}
              </div>
              <ChevronDown
                size={13}
                strokeWidth={2.5}
                className={clsx(
                  "text-gray-400 dark:text-slate-500 transition-transform duration-200",
                  showProfile && "rotate-180"
                )}
              />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#0f1117] rounded-2xl border border-slate-100 dark:border-white/10 shadow-2xl shadow-black/10 overflow-hidden z-50">
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-black text-base shrink-0 shadow-lg border-2 border-white dark:border-[#0f1117] uppercase">
                      {initials}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0f1117] shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate uppercase tracking-tighter">
                      {user?.fullName || "Kiddos Admin"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5">
                      {user?.email || "admin@kiddosfood.com"}
                    </p>
                  </div>
                </div>

                <div className="mx-4 border-t border-slate-100 dark:border-white/5" />

                <div className="py-1.5">
                  <Link
                    href="/settings/user/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase text-gray-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-950 transition-colors tracking-widest"
                  >
                    <Settings size={15} className="text-gray-400 shrink-0" />
                    User Settings
                  </Link>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase text-gray-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-950 transition-colors tracking-widest"
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun size={15} className="text-gray-400 shrink-0" />
                        Bright Aspect
                      </>
                    ) : (
                      <>
                        <Moon size={15} className="text-gray-400 shrink-0" />
                        Dim Aspect
                      </>
                    )}
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase text-gray-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-colors tracking-widest"
                  >
                    <LogOut size={15} className="text-gray-400 shrink-0" />
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
