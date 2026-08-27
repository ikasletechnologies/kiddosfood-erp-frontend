// This module previously contained a local copy of the unit conversion logic.
// It is now a thin re-export from the canonical shared package so the frontend
// and backend always use the identical conversion factors and rules.
//
// Use convertMeasurement directly from the package for new code.
// The convertUnit shim below maintains backward compatibility with existing
// callers (production/page.tsx, FormulaScalingTab.tsx, ActiveProductionRunsClient.tsx).


import { convertMeasurement, ValidUnit } from '@businessgroupikasle/erp-units';
/**
 * Backward-compatible shim. Converts `quantity` from `fromUnit` to `toUnit`.
 * Delegates to @businessgroupikasle/erp-units which is the single source of truth.
 * Returns `quantity` unchanged if units are the same or the conversion is not
 * supported (e.g. count vs. weight — avoids breaking existing callers that
 * rely on the identity fallback for PCS/packet/etc.).
 */
export function convertUnit(
  quantity: number,
  fromUnit?: string | null,
  toUnit?: string | null
): number {
  const from = (fromUnit || '').trim().toUpperCase();
  const to = (toUnit || '').trim().toUpperCase();
  if (!from || !to || from === to) return quantity;

  try {
    return convertMeasurement(quantity, from as ValidUnit, to as ValidUnit).toNumber();
  } catch {
    // Units are incompatible (cross-dimension) or unrecognized.
    // Return unchanged so existing UI comparisons degrade gracefully rather
    // than crashing — callers that need hard rejection should use
    // convertMeasurement directly and handle the error.
    return quantity;
  }
}

export { convertMeasurement };
