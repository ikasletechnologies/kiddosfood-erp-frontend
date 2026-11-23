"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Loader2, Search, X } from "lucide-react";
import { clsx } from "clsx";
import { NO_MATCH_TEXT, SEARCHING_TEXT, dedupeBy, normalizeSearch } from "@/lib/search";

export interface SearchAutocompleteProps<T> {
  /** Accessible name of the field (also the visible label when `showLabel`). */
  label: string;
  showLabel?: boolean;
  id?: string;
  /** Text in the input (controlled). */
  value: string;
  onInputChange: (text: string) => void;
  /** Suggestions to show (already filtered / fetched). Duplicates by key are dropped. */
  options: readonly T[];
  /** Stable key of an option: its database id. */
  getOptionKey: (option: T) => string;
  renderOption: (option: T, state: { active: boolean; disabled: boolean }) => ReactNode;
  /** Receives the full record (with its id), never just the display text. */
  onSelect: (option: T) => void;
  isOptionDisabled?: (option: T) => boolean;
  loading?: boolean;
  error?: string | null;
  /** Clear button handler. Must reset both the text and the selected id. Defaults to clearing the text. */
  onClear?: () => void;
  placeholder?: string;
  emptyText?: string;
  /** Characters needed before the list opens. 0 opens the list on focus. Default 1. */
  minChars?: number;
  /** Extra row(s) below the options, e.g. "Create vendor". Receives a close() helper. */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  listClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Hide the leading search icon. */
  hideIcon?: boolean;
  /** Called when the input gains focus (e.g. to lazy-load a list once). */
  onFocus?: () => void;
}

/**
 * Accessible search autocomplete (WAI-ARIA combobox + listbox).
 * - Suggestions render directly below the input.
 * - Arrow Up / Down move, Enter selects, Escape closes, Tab / click outside close.
 * - Shows "Searching…" while loading and "No matching records found" when empty.
 * - Options are de-duplicated by `getOptionKey`; disabled options cannot be selected.
 */
export default function SearchAutocomplete<T>({
  label,
  showLabel = false,
  id,
  value,
  onInputChange,
  options,
  getOptionKey,
  renderOption,
  onSelect,
  isOptionDisabled,
  loading = false,
  error = null,
  onClear,
  placeholder,
  emptyText = NO_MATCH_TEXT,
  minChars = 1,
  footer,
  disabled = false,
  autoFocus = false,
  className,
  inputClassName,
  listClassName,
  inputRef,
  hideIcon = false,
  onFocus,
}: SearchAutocompleteProps<T>) {
  const autoId = useId().replace(/:/g, "");
  const baseId = id || `sa-${autoId}`;
  const listboxId = `${baseId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const items = useMemo(() => dedupeBy(options, getOptionKey), [options, getOptionKey]);
  const isDisabled = useCallback((o: T) => !!isOptionDisabled?.(o), [isOptionDisabled]);
  const queryLength = normalizeSearch(value).length;
  const canOpen = !disabled && queryLength >= minChars;
  const close = useCallback(() => { setOpen(false); setActiveIndex(-1); }, []);

  // Close on click / tap outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open, close]);

  // New result set -> highlight the first selectable option.
  useEffect(() => {
    if (!open) return;
    setActiveIndex(items.findIndex(o => !isDisabled(o)));
  }, [items, open, isDisabled]);

  // Keep the highlighted option visible while navigating.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = document.getElementById(`${baseId}-opt-${activeIndex}`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, baseId]);

  const move = (dir: 1 | -1) => {
    if (items.length === 0) return;
    let i = activeIndex;
    for (let step = 0; step < items.length; step++) {
      i = (i + dir + items.length) % items.length;
      if (!isDisabled(items[i])) { setActiveIndex(i); return; }
    }
  };

  const choose = (option: T) => {
    if (isDisabled(option)) return;
    onSelect(option);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      // Keys handled here don't reach page-level shortcuts (e.g. POS uses
      // window Arrow keys for cart rows and Escape to clear the cart).
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        if (!open) { if (canOpen) setOpen(true); return; }
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        if (!open) { if (canOpen) setOpen(true); return; }
        move(-1);
        break;
      case "Enter":
        if (open && activeIndex >= 0 && items[activeIndex] && !loading) {
          e.preventDefault();
          e.stopPropagation();
          choose(items[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // don't also close an enclosing modal
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  const clear = () => {
    if (onClear) onClear(); else onInputChange("");
    close();
    localInputRef.current?.focus();
  };

  const setRefs = (el: HTMLInputElement | null) => {
    localInputRef.current = el;
    if (typeof inputRef === "function") inputRef(el);
    else if (inputRef && typeof inputRef === "object") (inputRef as { current: HTMLInputElement | null }).current = el;
  };

  const footerNode = typeof footer === "function" ? footer(close) : footer;
  const showEmpty = !loading && !error && items.length === 0 && queryLength > 0;
  const showList = open && canOpen && (loading || !!error || items.length > 0 || showEmpty || !!footerNode);
  const activeId = showList && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={clsx("relative w-full", className)}>
      <label htmlFor={baseId} className={showLabel ? "block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5" : "sr-only"}>
        {label}
      </label>
      <div className="relative">
        {!hideIcon && (
          <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          ref={setRefs}
          id={baseId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-busy={loading || undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={e => {
            onInputChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            onFocus?.();
            if (canOpen || minChars === 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={clsx(
            "w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13151f] py-2 text-sm text-slate-800 dark:text-white outline-none placeholder:text-slate-400 focus:border-[#f58220] focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
            hideIcon ? "pl-3" : "pl-9",
            value ? "pr-14" : "pr-8",
            inputClassName,
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 size={13} aria-hidden="true" className="animate-spin text-[#f58220]" />}
          {value && !disabled && (
            <button
              type="button"
              aria-label={`Clear ${label}`}
              onMouseDown={e => e.preventDefault()}
              onClick={clear}
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={label}
        hidden={!showList}
        className={clsx(
          "absolute left-0 right-0 top-full mt-1 z-[60] max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13151f] shadow-xl py-1",
          listClassName,
        )}
      >
        {loading && (
          <li role="status" aria-live="polite" className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Loader2 size={13} aria-hidden="true" className="animate-spin text-[#f58220]" /> {SEARCHING_TEXT}
          </li>
        )}
        {!loading && error && (
          <li role="alert" className="px-3 py-3 text-xs text-rose-600 dark:text-rose-400">{error}</li>
        )}
        {showEmpty && (
          <li role="status" aria-live="polite" className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">{emptyText}</li>
        )}
        {!loading && !error && items.map((option, i) => {
          const optDisabled = isDisabled(option);
          const active = i === activeIndex;
          return (
            <li
              key={getOptionKey(option)}
              id={`${baseId}-opt-${i}`}
              role="option"
              aria-selected={active}
              aria-disabled={optDisabled || undefined}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => { if (!optDisabled) setActiveIndex(i); }}
              onClick={() => choose(option)}
              className={clsx(
                "px-3 py-2 text-left transition-colors",
                optDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                active && !optDisabled ? "bg-orange-50 dark:bg-white/[0.06]" : "",
              )}
            >
              {renderOption(option, { active, disabled: optDisabled })}
            </li>
          );
        })}
        {footerNode && <li role="presentation" className="border-t border-slate-100 dark:border-white/5 mt-1 pt-1">{footerNode}</li>}
      </ul>
    </div>
  );
}
