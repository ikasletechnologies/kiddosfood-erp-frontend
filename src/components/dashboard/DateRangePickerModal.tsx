"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, X, Check, ArrowRight } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string, presetLabel?: string) => void;
}

export function DateRangePickerModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  onApply,
}: DateRangePickerModalProps) {
  const today = new Date();
  const [localStart, setLocalStart] = useState(startDate || format(subDays(today, 7), "yyyy-MM-dd"));
  const [localEnd, setLocalEnd] = useState(endDate || format(today, "yyyy-MM-dd"));
  const [activePreset, setActivePreset] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      label: "Today",
      getRange: () => ({
        start: format(today, "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
    {
      label: "Yesterday",
      getRange: () => {
        const y = subDays(today, 1);
        return {
          start: format(y, "yyyy-MM-dd"),
          end: format(y, "yyyy-MM-dd"),
        };
      },
    },
    {
      label: "Last 7 Days",
      getRange: () => ({
        start: format(subDays(today, 6), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
    {
      label: "Last 30 Days",
      getRange: () => ({
        start: format(subDays(today, 29), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
    {
      label: "This Month",
      getRange: () => ({
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(endOfMonth(today), "yyyy-MM-dd"),
      }),
    },
    {
      label: "Last Month",
      getRange: () => {
        const lm = subMonths(today, 1);
        return {
          start: format(startOfMonth(lm), "yyyy-MM-dd"),
          end: format(endOfMonth(lm), "yyyy-MM-dd"),
        };
      },
    },
    {
      label: "Year to Date",
      getRange: () => ({
        start: format(startOfYear(today), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
  ];

  const handleSelectPreset = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    setLocalStart(range.start);
    setLocalEnd(range.end);
    setActivePreset(preset.label);
  };

  const handleApply = () => {
    if (!localStart || !localEnd) return;
    onApply(localStart, localEnd, activePreset || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#12141c] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <CalendarIcon size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
                Custom Date Filter
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">Select a predefined range or custom calendar dates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Quick Presets */}
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 sm:mb-2.5">
              Quick Select Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map((preset) => {
                const isSelected = activePreset === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all text-center border ${
                      isSelected
                        ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                        : "bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Inputs */}
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2.5">
              Custom Range Boundaries
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500">From Date</span>
                <input
                  type="date"
                  value={localStart}
                  onChange={(e) => {
                    setLocalStart(e.target.value);
                    setActivePreset(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500">To Date</span>
                <input
                  type="date"
                  value={localEnd}
                  onChange={(e) => {
                    setLocalEnd(e.target.value);
                    setActivePreset(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Summary Preview */}
          <div className="p-3 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-500/20 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
              <span>{localStart ? format(new Date(localStart), "MMM dd, yyyy") : "Start"}</span>
              <ArrowRight size={12} className="text-orange-500" />
              <span>{localEnd ? format(new Date(localEnd), "MMM dd, yyyy") : "End"}</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Active Selection
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Check size={14} /> Apply Range
          </button>
        </div>
      </div>
    </div>
  );
}
