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
  Search
} from "lucide-react";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
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

  const [expandedMenus, setExpandedMenus] = useState<string[]>(["Sales CRM"]);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navRef = useRef<HTMLElement>(null);

  const checkScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scrollNav = (dir: "up" | "down") =>
    navRef.current?.scrollBy({ top: dir === "up" ? -140 : 140, behavior: "smooth" });

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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm lg:hidden z-[90]" 
          onClick={closeMobile}
        />
      )}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 lg:relative flex flex-col h-screen shrink-0 sidebar-transition z-[100] lg:z-50",
          "bg-white dark:bg-[#0b0c10] transition-all duration-500 ease-in-out",
          isCollapsed ? "lg:w-[88px]" : "lg:w-[280px] border-r border-slate-100 dark:border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.02)] dark:shadow-none",
          isMobileOpen ? "translate-x-0 w-[280px] border-r border-slate-100 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ── Brand / User Header ─────────────────────── */}
        <div
          className={clsx(
            "flex items-center border-b border-slate-100 dark:border-white/5 shrink-0 transition-all duration-300",
            isCollapsed ? "px-2 py-4 justify-center" : "px-5 py-5 justify-between"
          )}
        >
          <div className={clsx(
            "relative flex items-center justify-center transition-all duration-500",
            isCollapsed ? "w-12 h-12" : "w-48 h-12"
          )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Mobile Close Button */}
          {(!isCollapsed || isMobileOpen) && (
            <button
              onClick={closeMobile}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>

        {/* ── Search Bar ──────────────────────────────── */}
        {!isCollapsed && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 shrink-0 transition-all duration-300">
            <div className="relative group">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" 
                size={14} 
              />
              <input
                type="text"
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border-transparent rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:bg-white dark:focus:bg-[#0b0c10] focus:border-primary/30 focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-300"
              />
            {searchTerm && (
              <CloseIcon 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchTerm("")} 
              />
            )}
            </div>
          </div>
        )}

        {/* ── Nav Wrapper ─────────────────────────────── */}
        <div className="relative flex-1 flex flex-col min-h-0">

          {/* Scroll Up */}
          {canScrollUp && (
            <div className="absolute top-0 inset-x-0 flex justify-center pt-1 z-10 pointer-events-none">
              {/* Scroll indicator hidden as per icon removal request */}
            </div>
          )}

          {/* Navigation */}
          <nav
            ref={navRef}
            className={clsx(
              "flex-1 overflow-y-auto hide-scrollbar",
              "px-4 py-4"
            )}
          >
            <div className="space-y-0.5">
              {sections.map((section) => {
                const filteredItems = section.items.filter(
                  (item) => !user || item.roles.includes(userRole)
                );
                
                const finalItems = filteredItems.filter(item => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  if (section.title.toLowerCase().includes(term)) return true;
                  if (item.label.toLowerCase().includes(term)) return true;
                  if (item.children?.some(c => c.label.toLowerCase().includes(term))) return true;
                  return false;
                });

                if (finalItems.length === 0) return null;

                const isSectionCollapsed = collapsedSections.includes(section.title) && !searchTerm;

                return (
                  <div key={section.title}>
                    {/* Section Header */}
                    {!isCollapsed && (
                      <div 
                        onClick={() => toggleSection(section.title)}
                        className="px-2 pb-2 mt-6 flex items-center justify-between cursor-pointer group/section"
                      >
                        <p className={clsx(
                          "text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
                          "text-slate-400 dark:text-slate-500 group-hover/section:text-primary"
                        )}>
                          {section.title}
                        </p>
                        <ChevronDown 
                          size={10} 
                          className={clsx(
                            "text-slate-300 dark:text-slate-700 transition-transform duration-300",
                            isSectionCollapsed ? "-rotate-90" : "rotate-0"
                          )} 
                        />
                      </div>
                    )}

                    {isCollapsed && (
                      <div className="h-px bg-slate-100 dark:bg-white/5 my-3 mx-4" />
                    )}

                    <div className={clsx(
                      "space-y-1 transition-all duration-300 overflow-hidden",
                      isSectionCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                    )}>

                    {/* Section Items */}
                    {finalItems.map((item) => {
                      const itemIcon = item.icon;
                      const isExpanded = expandedMenus.includes(item.label) || !!searchTerm;
                      const hasChildren = !!item.children?.length;

                      const currentReportParent = pathname === "/reports" ? (searchParams?.get("parent") || "production") : null;
                      const isReportItem = item.href.startsWith("/reports?parent=");
                      const itemReportParent = isReportItem ? item.href.replace("/reports?parent=", "") : null;

                      const isActive = isReportItem
                        ? pathname === "/reports" && currentReportParent === itemReportParent
                        : pathname === item.href ||
                          fullPath === item.href ||
                          (hasChildren && item.children?.some((c) => pathname === c.href || fullPath === c.href));
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
                          {/* Row */}
                          <div
                            onClick={() => (!hasChildren && !isComingSoon) ? undefined : (hasChildren ? toggleMenu(item.label) : undefined)}
                            className={clsx(
                              "flex items-center select-none transition-all duration-300 relative group/item",
                              isCollapsed ? "justify-center px-0 w-12 h-12 mx-auto" : "px-4 py-2.5 gap-3",
                              "my-0.5 rounded-xl",
                              isComingSoon ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer",
                              isActive
                                ? "bg-primary/10 text-primary font-bold scale-[1.01]"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            {/* Prefix Icon */}
                            {IconComponent && isCollapsed && (
                              <div className={clsx(
                                "flex items-center justify-center shrink-0 transition-all duration-300",
                                "w-10 h-10",
                                isActive 
                                  ? "text-primary" 
                                  : "text-slate-400 group-hover/item:text-primary dark:group-hover/item:text-primary"
                              )}>
                                <IconComponent size={20} strokeWidth={isActive ? 2.5 : 2} />
                              </div>
                            )}

                            {/* Label (Visible only when expanded) */}
                            {!isCollapsed && (
                              <>
                                {hasChildren ? (
                                  <span className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-[13px] font-semibold flex-1 truncate tracking-tight">{item.label}</span>
                                  </span>
                                ) : (
                                  isComingSoon ? (
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <span className="text-[13px] font-semibold flex-1 truncate tracking-tight text-slate-400">{item.label}</span>
                                    </div>
                                  ) : (
                                    <Link
                                      href={item.href}
                                      className="flex items-center gap-3 flex-1 min-w-0"
                                      onClick={(e) => { e.stopPropagation(); closeMobile(); }}
                                    >
                                      <span className="text-[13px] font-semibold flex-1 truncate tracking-tight">{item.label}</span>
                                    </Link>
                                  )
                                )}


                                {item.isComingSoon && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">Soon</span>
                                )}
                                {item.isHot && !item.isNew && !item.isComingSoon && (
                                  <span className="badge-hot shrink-0">Hot</span>
                                )}
                                {hasChildren && (
                                  <ChevronRight
                                    size={12}
                                    strokeWidth={2.5}
                                    className={clsx(
                                      "shrink-0 text-slate-400 dark:text-slate-500 group-hover/item:text-primary transition-transform duration-200",
                                      isExpanded && (isActive ? "rotate-90 text-primary" : "rotate-90")
                                    )}
                                  />
                                )}
                              </>
                            )}
                          </div>

                          {/* Tooltip (collapsed) */}
                          {isCollapsed && isHovered && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] pointer-events-none">
                              <div className="bg-gray-900 dark:bg-slate-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                                {item.label}
                                {item.isNew && (
                                  <span className="ml-1.5 text-primary text-[9px] font-bold">NEW</span>
                                )}
                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-slate-700" />
                              </div>
                            </div>
                          )}

                          {/* Submenu */}
                          {!isCollapsed && hasChildren && isExpanded && (
                            <div className="pl-11 mt-1 space-y-1 pb-2 relative">
                              {/* Connector Line */}
                              <div className="absolute left-[23px] top-0 bottom-4 w-px bg-slate-100 dark:bg-white/5" />
                              
                              {item.children?.map((child) => {
                                // hide children if they don't match the search term
                                if (searchTerm) {
                                  const term = searchTerm.toLowerCase();
                                  const matchesChild = child.label.toLowerCase().includes(term);
                                  const matchesItem = item.label.toLowerCase().includes(term);
                                  const matchesSection = section.title.toLowerCase().includes(term);
                                  if (!matchesChild && !matchesItem && !matchesSection) return null;
                                }
                                return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={closeMobile}
                                  className={clsx(
                                    "flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium transition-all relative",
                                    pathname === child.href
                                      ? "text-primary dark:text-primary-foreground bg-primary/10 dark:bg-primary/20 font-semibold"
                                      : "text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
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
            </div>
          </nav>

          {/* Scroll Down */}
          {canScrollDown && (
            <div className="absolute bottom-0 inset-x-0 flex justify-center pb-1 z-10 pointer-events-none">
              {/* Scroll indicator hidden as per icon removal request */}
            </div>
          )}
        </div>

        {/* ── Footer Removed ────────────────────────── */}
      </aside>
    </>
  );
}
