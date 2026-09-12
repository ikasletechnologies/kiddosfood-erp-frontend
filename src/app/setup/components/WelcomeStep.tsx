"use client";

import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

const CARD_CLASS =
  "w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-slate-800/50 p-10 space-y-8";

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {done ? (
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
      ) : (
        <Circle size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />
      )}
      <span className={done ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
        {label}
      </span>
    </div>
  );
}

export default function WelcomeStep({
  hqConfigured,
  onGetStarted,
}: {
  hqConfigured: boolean;
  onGetStarted: () => void;
}) {
  return (
    <div className={CARD_CLASS}>
      <div className="text-center space-y-3">
        <div className="relative w-48 h-20 mx-auto mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kiddos Food Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome to Kiddos Foods ERP</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Let&apos;s complete your initial setup before you start using the system.
        </p>
      </div>

      <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Setup progress</p>
        <ChecklistRow label="Super Admin" done />
        <ChecklistRow label="Headquarters" done={hqConfigured} />
        <ChecklistRow label="Main Warehouse" done={false} />
      </div>

      <button
        onClick={onGetStarted}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        Start Setup
      </button>
    </div>
  );
}
