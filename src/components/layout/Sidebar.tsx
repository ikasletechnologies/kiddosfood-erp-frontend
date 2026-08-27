"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LogOut,
  ChevronRight,
  ChevronUp,
  Plus,
  Receipt,
  ChevronDown,
  Sun,
  Moon,
  Landmark,
  Store,
  X as CloseIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { useState, useRef, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { SUPER_ADMIN_SIDEBAR, franchiseMenuSections } from "@/config/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams?.toString();
  const fullPath = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleCollapsed, isMobileOpen, closeMobile } = useSidebar();

  const [expandedMenus, setExpandedMenus] = useState<string[]>(["Sales CRM", "PROCUREMENT", "PRODUCTION"]);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navRef = useRef<HTMLElement>(null);

  const toggleMenu = (label: string) => {
    if (isCollapsed) return;
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const userRole = user?.role?.toUpperCase() || "";
  const isFranchiseUser = userRole === "FRANCHISE_ADMIN";
  const sections = isFranchiseUser ? franchiseMenuSections : SUPER_ADMIN_SIDEBAR;

  if (pathname === "/login") return null;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm lg:hidden z-[90] animate-in fade-in duration-200"
          onClick={closeMobile}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 lg:relative flex flex-col h-screen shrink-0 z-[100] lg:z-50",
          "bg-white dark:bg-[#0b0c10] border-r border-slate-200/70 dark:border-white/5",
          "transition-all duration-300 ease-in-out",
          isCollapsed ? "lg:w-[80px]" : "lg:w-[270px] shadow-[0_4px_24px_rgba(0,0,0,0.02)]",
          isMobileOpen
            ? "translate-x-0 w-[270px] shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ── Brand Header ─────────────────────── */}
        <div
          className={clsx(
            "flex items-center border-b border-slate-100 dark:border-white/5 shrink-0 transition-all duration-300",
            isCollapsed ? "px-3 py-4 justify-center" : "px-5 py-4 justify-between"
          )}
        >
          <Link
            href="/"
            className={clsx(
              "flex items-center gap-2.5 transition-all duration-300",
              isCollapsed ? "w-10 h-10 justify-center" : "w-full"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Kiddos Foods ERP"
              className={clsx(
                "object-contain transition-all duration-300",
                isCollapsed ? "w-8 h-8" : "h-9 max-w-[170px]"
              )}
            />
          </Link>

          {/* Mobile Close Button */}
          {(!isCollapsed || isMobileOpen) && (
            <button
              onClick={closeMobile}
              className="lg:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        {/* ── Search Bar (Visible only when expanded) ── */}
        {!isCollapsed && (
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/5 shrink-0">
            <div className="relative group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F58220] transition-colors"
                size={14}
              />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 rounded-xl pl-9 pr-7 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-[#11131c] focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all"
              />
              {searchTerm && (
                <CloseIcon
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => setSearchTerm("")}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Navigation Tree ─────────────────────────── */}
        <nav
          ref={navRef}
          className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-6"
        >
          {sections.map((section) => {
            const filteredItems = section.items.filter(
              (item) => !user || item.roles.includes(userRole)
            );

            const finalItems = filteredItems.filter((item) => {
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              if (section.title.toLowerCase().includes(term)) return true;
              if (item.label.toLowerCase().includes(term)) return true;
              if (item.children?.some((c) => c.label.toLowerCase().includes(term)))
                return true;
              return false;
            });

            if (finalItems.length === 0) return null;

            const isSectionCollapsed =
              collapsedSections.includes(section.title) && !searchTerm;

            return (
              <div key={section.title} className="space-y-1">
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between group/sec text-left"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 group-hover/sec:text-[#F58220] transition-colors">
                      {section.title}
                    </span>
                    <ChevronDown
                      size={12}
                      className={clsx(
                        "text-slate-300 dark:text-slate-600 transition-transform duration-200",
                        isSectionCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <div className="h-px bg-slate-100 dark:bg-white/5 my-2 mx-2" />
                )}

                {/* Section Items */}
                <div
                  className={clsx(
                    "space-y-0.5 transition-all duration-200 overflow-hidden",
                    isSectionCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                  )}
                >
                  {finalItems.map((item) => {
                    const itemIcon = item.icon;
                    const isExpanded =
                      expandedMenus.includes(item.label) || !!searchTerm;
                    const hasChildren = !!item.children?.length;

                    const currentReportParent =
                      pathname === "/reports"
                        ? searchParams?.get("parent") || "production"
                        : null;
                    const isReportItem = item.href.startsWith("/reports?parent=");
                    const itemReportParent = isReportItem
                      ? item.href.replace("/reports?parent=", "")
                      : null;

                    const isActive = isReportItem
                      ? pathname === "/reports" && currentReportParent === itemReportParent
                      : pathname === item.href ||
                        fullPath === item.href ||
                        (hasChildren &&
                          item.children?.some(
                            (c) => pathname === c.href || fullPath === c.href
                          ));

                    const isHovered = hoveredItem === item.label;
                    const isComingSoon = item.isComingSoon;
                    const IconComponent = itemIcon;

                    return (
                      <div
                        key={item.label}
                        className="relative"
                        onMouseEnter={() => setHoveredItem(item.label)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {/* Menu Item Link/Button */}
                        <div
                          onClick={() => {
                            if (hasChildren) {
                              toggleMenu(item.label);
                            }
                          }}
                          className={clsx(
                            "group/nav flex items-center select-none transition-all duration-200 relative rounded-2xl",
                            isCollapsed
                              ? "justify-center w-11 h-11 mx-auto"
                              : "px-3 py-2.5 gap-2.5",
                            isComingSoon
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer",
                            isActive
                              ? "bg-orange-50/90 dark:bg-orange-950/30 text-slate-900 dark:text-white font-bold"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:text-slate-900 dark:hover:text-slate-200"
                          )}
                        >
                          {/* Active Left Indicator Pill (Expanded) */}
                          {!isCollapsed && isActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#F58220]" />
                          )}

                          {/* Prefix Icon (Visible ONLY when collapsed) */}
                          {IconComponent && isCollapsed && (
                            <div
                              className={clsx(
                                "flex items-center justify-center shrink-0 transition-transform duration-200",
                                isActive
                                  ? "text-[#F58220] dark:text-orange-400"
                                  : "text-slate-400 group-hover/nav:text-slate-700 dark:group-hover/nav:text-slate-300"
                              )}
                            >
                              <IconComponent
                                size={19}
                                strokeWidth={isActive ? 2.4 : 1.9}
                              />
                            </div>
                          )}

                          {/* Label (Expanded) */}
                          {!isCollapsed && (
                            <>
                              {hasChildren ? (
                                <span className="flex-1 text-xs font-semibold truncate tracking-tight">
                                  {item.label}
                                </span>
                              ) : isComingSoon ? (
                                <span className="flex-1 text-xs font-semibold truncate tracking-tight text-slate-400">
                                  {item.label}
                                </span>
                              ) : (
                                <Link
                                  href={item.href}
                                  className="flex-1 text-xs font-semibold truncate tracking-tight"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeMobile();
                                  }}
                                >
                                  {item.label}
                                </Link>
                              )}

                              {item.isComingSoon && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-white/5 text-slate-400 uppercase tracking-widest">
                                  Soon
                                </span>
                              )}

                              {hasChildren && (
                                <ChevronRight
                                  size={13}
                                  className={clsx(
                                    "text-slate-400 transition-transform duration-200",
                                    isExpanded && "rotate-90 text-[#F58220]"
                                  )}
                                />
                              )}
                            </>
                          )}
                        </div>

                        {/* Collapsed Tooltip */}
                        {isCollapsed && isHovered && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap flex items-center gap-1.5 border border-slate-700">
                              <span>{item.label}</span>
                            </div>
                          </div>
                        )}

                        {/* Submenu Children */}
                        {!isCollapsed && hasChildren && isExpanded && (
                          <div className="pl-7 mt-1 space-y-0.5 relative">
                            <div className="absolute left-4 top-0 bottom-2 w-px bg-slate-200/80 dark:bg-white/5" />
                            {item.children?.map((child) => {
                              if (searchTerm) {
                                const term = searchTerm.toLowerCase();
                                const matchesChild = child.label
                                  .toLowerCase()
                                  .includes(term);
                                if (!matchesChild) return null;
                              }

                              const isChildActive =
                                pathname === child.href || fullPath === child.href;

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={closeMobile}
                                  className={clsx(
                                    "flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                                    isChildActive
                                      ? "text-[#F58220] bg-orange-50/80 dark:bg-orange-950/20 font-bold"
                                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                  )}
                                >
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Footer / Collapse Toggle ─────────────────── */}
        <div className="p-3 border-t border-slate-100 dark:border-white/5 shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={clsx(
              "w-full flex items-center justify-center gap-2 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-xs font-bold",
              isCollapsed && "px-0"
            )}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <>
                <PanelLeftClose size={16} />
                <span className="truncate text-[11px] uppercase tracking-wider">Collapse Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
