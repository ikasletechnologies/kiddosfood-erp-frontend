"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

export default function TransactionActionsMenu({
  hasInvoice,
  busy,
  onView,
  onPrint,
  onDownload,
}: TransactionActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // 12rem = 192px
    const menuHeight = 130;

    // Calculate left: align menu right edge to button right edge
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    // Check if dropdown fits below button, else flip above
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight && rect.top - menuHeight - 6 > 0) {
      top = rect.top - menuHeight - 6;
    }

    setCoords({ top, left });
  };

  const toggleMenu = () => {
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  return (
    <div className="inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs active:scale-95"
        title="Transaction Actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && mounted && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
          }}
          className="w-48 bg-white dark:bg-[#13151f] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1 text-left space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {hasInvoice ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onView();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Eye size={13} className="text-orange-500 shrink-0" />
                <span>View Invoice</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onPrint();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Printer size={13} className="text-blue-500 shrink-0" />
                <span>Print Invoice</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onDownload();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Download size={13} className="text-emerald-500 shrink-0" />
                <span>Download Invoice</span>
              </button>
            </>
          ) : (
            <div className="px-3 py-2 text-xs font-medium text-slate-400">No actions available</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
