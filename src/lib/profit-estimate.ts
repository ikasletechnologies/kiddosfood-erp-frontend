// Estimated profit/loss for Sales Orders and POS. All figures come from the
// server (which re-prices exactly as saving / checkout and costs stock under
// the existing finished-goods policy); this only fetches and formats them.
import { useEffect, useState } from "react";

export type ProfitStatus = "PROFIT" | "LOSS" | "BREAK_EVEN" | "COST_UNAVAILABLE";

export interface EstimatedLine {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number; // before discounts, excl. GST
  netUnitPrice: number; // after discounts, excl. GST
  netRevenue: number;
  unitCost: number | null;
  costOfGoods: number | null;
  unitProfit: number | null;
  profit: number | null;
  marginPct: number | null;
  status: ProfitStatus;
  costReason?: string;
  warning: string | null;
}

export interface ProfitSummary {
  netRevenue: number;
  costOfGoods: number | null;
  profit: number | null;
  marginPct: number | null;
  costUnavailableLines: number;
  costedRevenue: number;
  status: ProfitStatus;
}

export interface ProfitEstimate { lines: EstimatedLine[]; summary: ProfitSummary }

/** Mirrors the server allowlist (canViewCost); the server enforces it regardless. */
export const COST_VIEW_ROLES = ["SUPER_ADMIN", "FRANCHISE_ADMIN"];
export function canViewCost(user: any): boolean {
  const role = String(user?.role?.name || user?.role || "").toUpperCase();
  return COST_VIEW_ROLES.includes(role);
}

export const money = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
export const signedMoney = (n: number) => (n === 0 ? "₹0" : `${n < 0 ? "−" : "+"}${money(n)}`);
export const toneOf = (status: ProfitStatus) =>
  status === "LOSS" ? "text-rose-600 dark:text-rose-400"
    : status === "PROFIT" ? "text-emerald-600 dark:text-emerald-400"
    : status === "COST_UNAVAILABLE" ? "text-gray-400"
    : "text-gray-700 dark:text-slate-300";

/**
 * Debounced server estimate. `key` is a stable string of the inputs; a new
 * key refetches, and stale responses are dropped. Disabled → nothing fetched.
 */
export function useProfitEstimate(fetcher: () => Promise<{ data: ProfitEstimate }>, key: string, enabled: boolean) {
  const [estimate, setEstimate] = useState<ProfitEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !key) { setEstimate(null); setLoading(false); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetcher()
        .then((res) => { if (!cancelled) { setEstimate(res.data); setError(null); } })
        .catch((e) => { if (!cancelled) { setEstimate(null); setError(e?.response?.status === 403 ? null : e?.response?.data?.error || "Profit estimate unavailable"); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { estimate, loading, error };
}
