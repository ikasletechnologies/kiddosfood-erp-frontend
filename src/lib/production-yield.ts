// Planned vs actual production yield, computed the same way on every screen.
// Mirrors ProductionService.computeYieldVariance on the backend.

type RunLike = {
  quantity?: number | null;
  plannedYieldQty?: number | null;
  plannedYieldUnit?: string | null;
  actualYield?: number | null;
  recipe?: { yieldQty?: number | null; yieldUnit?: string | null } | null;
} | null | undefined;

/**
 * Planned yield of a production run. Runs started from a saved formulation
 * (and every run completed since) store it; older in-flight runs derive it
 * from runs × recipe yield, exactly as before.
 */
export function plannedYieldOf(run: RunLike): { qty: number | null; unit: string } {
  const unit = run?.plannedYieldUnit || run?.recipe?.yieldUnit || "KG";
  if (run?.plannedYieldQty != null) return { qty: run.plannedYieldQty, unit };
  const runs = Number(run?.quantity);
  const refYield = Number(run?.recipe?.yieldQty);
  return { qty: runs > 0 && refYield > 0 ? runs * refYield : null, unit };
}

/** Difference (3 dp) and % of plan (2 dp); pct null when there's no plan. */
export function yieldVariance(planned: number | null, actual: number | null) {
  if (planned == null || actual == null || !Number.isFinite(planned) || !Number.isFinite(actual)) {
    return { difference: null as number | null, pct: null as number | null };
  }
  const difference = Math.round((actual - planned) * 1000) / 1000;
  const pct = planned > 0 ? Math.round((difference / planned) * 10000) / 100 : null;
  return { difference, pct };
}

export const fmtYield = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

export const fmtSigned = (n: number | null | undefined, suffix = "") =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${fmtYield(n)}${suffix}`;

/** Tailwind text colour for a variance: over plan green, under plan amber, on plan grey. */
export const varianceTone = (difference: number | null) =>
  difference == null || Math.abs(difference) < 0.0005
    ? "text-gray-500 dark:text-slate-400"
    : difference > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";
