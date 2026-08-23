"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

interface UserAccountLayoutProps {
  children: ReactNode;
}

export default function UserAccountLayout({ children }: UserAccountLayoutProps) {
  const pathname = usePathname();

  const menuItems = [
    { label: "Personal Information", href: "/settings/user/profile" },
    { label: "Password & Security", href: "/settings/user/security" },
  ];

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-80px)] animate-in fade-in duration-500">
      {/* User Settings Sidebar */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-6 flex flex-col justify-between shrink-0">
        <div>
           <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 px-4">User Settings</h2>
           <nav className="space-y-1">
             {menuItems.map((item) => {
               const isActive = pathname === item.href;
               return (
                 <Link
                   key={item.href}
                   href={item.href}
                   className={clsx(
                     "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
                     isActive 
                       ? "bg-orange-50 text-orange-600 shadow-sm dark:bg-orange-500/20 dark:text-orange-400" 
                       : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-white"
                   )}
                 >
                   {item.label}
                 </Link>
               );
             })}
           </nav>
        </div>
      </div>
 
       {/* Content Area */}
      <div className="flex-1 p-6 md:p-10 max-w-7xl overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
