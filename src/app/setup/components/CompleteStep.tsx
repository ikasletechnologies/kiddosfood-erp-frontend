"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PartyPopper,
  CheckCircle2,
  Loader2,
  Package,
  Boxes,
  FlaskConical,
  PackagePlus,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";
import type { CreatedHq, CreatedWarehouse } from "../page";

const CARD_CLASS =
  "w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-slate-800/50 p-10 space-y-6";

const NEXT_STEPS = [
  { icon: Package, label: "Import Finished Goods", action: "Import", href: "/inventory/stock?type=FINISHED_GOOD" },
  { icon: Boxes, label: "Add Raw Materials", action: "Add", href: "/inventory/stock?type=RAW_MATERIAL" },
  { icon: FlaskConical, label: "Configure Recipes", action: "Configure", href: "/production/recipes" },
  { icon: PackagePlus, label: "Add Opening Stock", action: "Add Stock", href: "/inventory/stock/add" },
  { icon: ShoppingCart, label: "Start POS", action: "Open POS", href: "/pos" },
];

export default function CompleteStep({
  hq,
  warehouse,
  onFinish,
}: {
  hq: CreatedHq;
  warehouse: CreatedWarehouse;
  onFinish: () => Promise<void>;
}) {
  const [finishing, setFinishing] = useState(false);

  const handleFinish = async () => {
    setFinishing(true);
    await onFinish();
  };

  return (
    <div className={CARD_CLASS}>
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
          <PartyPopper size={26} className="text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your Headquarters is ready</h2>
      </div>

      <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Headquarters</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{hq.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Main Warehouse</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{warehouse.name}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recommended next steps</p>
        <div className="space-y-2">
          {NEXT_STEPS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 transition-colors group"
            >
              <span className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <item.icon size={16} className="text-slate-400 group-hover:text-orange-500" />
                {item.label}
              </span>
              <span className="text-xs font-semibold text-orange-500">{item.action}</span>
            </Link>
          ))}
        </div>
      </div>

      <button
        onClick={handleFinish}
        disabled={finishing}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {finishing ? <Loader2 size={18} className="animate-spin" /> : <>Continue to ERP <ArrowRight size={18} /></>}
      </button>
    </div>
  );
}
