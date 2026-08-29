"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreVertical, Eye, Printer, Download } from "lucide-react";

interface TransactionActionsMenuProps {
  // Only Sale/POS Sale rows have a real backing Invoice — every other
  // transaction type (Delivery Challan, Payment, Return...) must not show
  // invoice actions it can't actually perform.
  hasInvoice: boolean;
  busy?: boolean;
  onView: () => void;
  onPrint: () => void;
  onDownload: () => void;
}

export default function TransactionActionsMenu({ hasInvoice, busy, onView, onPrint, onDownload }: TransactionActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-200 transition-colors"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#13151f] border border-slate-200 dark:border-white/10 rounded-lg shadow-xl z-50 py-1 text-left">
          {hasInvoice ? (
            <>
              <button
                disabled={busy}
                onClick={() => { setOpen(false); onView(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
              >
                <Eye size={13} /> View Invoice
              </button>
              <button
                disabled={busy}
                onClick={() => { setOpen(false); onPrint(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
              >
                <Printer size={13} /> Print Invoice
              </button>
              <button
                disabled={busy}
                onClick={() => { setOpen(false); onDownload(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
              >
                <Download size={13} /> Download Invoice
              </button>
            </>
          ) : (
            <div className="px-3 py-2 text-xs font-medium text-slate-400">No actions available</div>
          )}
        </div>
      )}
    </div>
  );
}
