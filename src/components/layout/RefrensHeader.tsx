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
  Sparkles,
  Command,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { SUPER_ADMIN_SIDEBAR, menuItems } from "@/config/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useNotification, Notification } from "@/context/NotificationContext";
import Link from "next/link";

function NIcon({ type }: { type: Notification["type"] }) {
  if (type === "success") return <CheckCircle size={14} className="text-emerald-500 shrink-0" />;
  if (type === "alert") return <AlertTriangle size={14} className="text-rose-500 shrink-0" />;
  if (type === "warning") return <AlertCircle size={14} className="text-amber-500 shrink-0" />;
  return <Info size={14} className="text-blue-500 shrink-0" />;
}

function HBtn({
  children,
  title,
  onClick,
  badge,
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
      className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all duration-150"
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-4 px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f1117] leading-none">
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
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
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#12141c] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-white/5">
          <Search size={18} className="text-[#F58220] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search modules, purchase orders, recipes, inventory..."
            className="flex-1 text-sm font-semibold text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto custom-scrollbar py-2 px-2">
          {filtered.length > 0 ? (
            filtered.map((item, index) => {
              const Icon = item.icon || Search;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.label + item.href}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left",
                    isSelected
                      ? "bg-orange-50 dark:bg-orange-950/30 text-[#F58220] dark:text-orange-400"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={15}
                      className={clsx(
                        "shrink-0",
                        isSelected ? "text-[#F58220]" : "text-slate-400"
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 opacity-60">
                    Jump →
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              No matching modules for &quot;{q}&quot;
            </div>
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

  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } =
    useNotification();

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const initials =
    user?.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "KF";

  const searchParams = useSearchParams();

  const getPageTitle = () => {
    const parentParam = searchParams?.get("parent");
    const fullPath = parentParam ? `${pathname}?parent=${parentParam}` : pathname;

    for (const section of SUPER_ADMIN_SIDEBAR) {
      for (const item of section.items) {
        if (item.href === fullPath) return item.label;
        if (item.children) {
          const child = item.children.find((c) => c.href === fullPath || c.href === pathname);
          if (child) return child.label;
        }
      }
    }

    for (const section of SUPER_ADMIN_SIDEBAR) {
      for (const item of section.items) {
        if (item.href === pathname) return item.label;
      }
    }

    if (pathname === "/") return "Executive Dashboard";
    return "";
  };

  const pageTitle = getPageTitle();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (pathname === "/login") return null;

  return (
    <>
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}

      <header className="w-full h-16 bg-white/95 dark:bg-[#0b0c10]/95 backdrop-blur-md border-b border-slate-200/70 dark:border-white/5 flex items-center px-3 sm:px-6 gap-1.5 sm:gap-3 sticky top-0 z-40">
        {/* ── Left: Hamburger toggles ──────────────────── */}
        <button
          onClick={toggleMobileOpen}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
          aria-label="Toggle Navigation"
        >
          <MenuIcon size={19} />
        </button>

        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
          title="Toggle Sidebar"
        >
          <MenuIcon size={19} />
        </button>

        {/* Dynamic Page Title */}
        {pageTitle && (
          <div className="flex items-center gap-2 sm:gap-3 pl-0.5 sm:pl-1 min-w-0 animate-in fade-in duration-200">
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10 shrink-0" />
            <h1 className="text-xs sm:text-[14px] font-black text-slate-900 dark:text-white tracking-tight uppercase truncate">
              <span className="sm:hidden">{pageTitle === "Executive Dashboard" ? "Executive" : pageTitle}</span>
              <span className="hidden sm:inline">{pageTitle}</span>
            </h1>
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {/* ── Right Navigation & User Controls ──────────── */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Spotlight Search Trigger */}
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 transition-all group"
            title="Quick search (Ctrl+K)"
          >
            <Search size={14} className="text-slate-400 group-hover:text-[#F58220] transition-colors shrink-0" />
            <span className="hidden sm:inline font-medium">Quick search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 shadow-sm">
              <Command size={10} /> K
            </kbd>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notifications Center */}
          <div className="relative" ref={notifRef}>
            <HBtn
              title="Notifications"
              badge={unreadCount > 0 ? unreadCount : undefined}
              onClick={() => {
                setShowNotifications((v) => !v);
                setShowProfile(false);
              }}
            >
              <Bell size={18} />
            </HBtn>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-white dark:bg-[#12141c] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden z-50 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Live Telemetry Alerts
                    </h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 text-[10px] font-bold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-black uppercase text-[#F58220] hover:underline tracking-wider"
                    >
                      Acknowledge All
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-white/[0.02]">
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
                        "group flex items-start gap-3.5 px-5 py-3.5 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors",
                        !n.read && "bg-orange-50/30 dark:bg-orange-950/10"
                      )}
                    >
                      <div className="mt-0.5">
                        <NIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {n.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {n.message}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-1"
                        title="Dismiss"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {notifications.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Bell size={24} className="mx-auto text-slate-300 dark:text-white/10 mb-2" />
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                        All Systems Normal
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                  <Link
                    href="/alerts"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] text-[#F58220] font-black uppercase text-center block tracking-wider hover:underline"
                  >
                    View Full System Audit Logs →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar & Menu */}
          <div className="relative ml-0.5 sm:ml-1" ref={profileRef}>
            <button
              onClick={() => {
                setShowProfile((v) => !v);
                setShowNotifications(false);
              }}
              className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-white/10 group"
              aria-label="User profile options"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-black text-xs group-hover:scale-105 transition-all shadow-sm uppercase">
                {initials}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {user?.fullName || "HQ Admin"}
                </p>
                <p className="text-[10px] text-slate-400 font-medium leading-tight uppercase">
                  {user?.role || "Super Admin"}
                </p>
              </div>
              <ChevronDown
                size={13}
                className={clsx(
                  "text-slate-400 transition-transform duration-200",
                  showProfile && "rotate-180"
                )}
              />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-xs sm:w-64 bg-white dark:bg-[#12141c] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden z-50 animate-in zoom-in-95 duration-150">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm flex items-center justify-center uppercase shadow-md">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {user?.fullName || "HQ Executive"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-medium">
                      {user?.email || "hq@kiddosfoods.com"}
                    </p>
                  </div>
                </div>

                <div className="p-2 space-y-0.5">
                  <Link
                    href="/settings/user/profile"
                    onClick={() => setShowProfile(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Settings size={15} className="text-slate-400" />
                    Account Settings
                  </Link>

                  <button
                    onClick={() => {
                      setShowProfile(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                  >
                    <LogOut size={15} className="text-rose-500" />
                    Sign Out
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
