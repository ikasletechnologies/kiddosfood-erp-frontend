// Live profit/loss for one packaging row. The production cost per packet
// comes from the server preview (same calculation Confirm posts); the price
// is whatever is on screen right now, so the result updates as you type.
// Worked in whole paise so per-packet × packets equals the total exactly.

export type ProfitStatus = "PROFIT" | "LOSS" | "BREAK_EVEN";

export interface ProfitResult {
  perPacket: number;
  total: number;
  status: ProfitStatus;
  message: string;
}

const paise = (n: number) => Math.round(n * 100);
export const fmtInr = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** Null when there's no cost yet, no valid price (> 0) or no good packets. */
export function profitOf(costPerPacket: number | null | undefined, price: number | null | undefined, goodPackets: number): ProfitResult | null {
  if (costPerPacket == null || !Number.isFinite(costPerPacket)) return null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  if (!(goodPackets > 0)) return null;
  const per = paise(price) - paise(costPerPacket);
  const total = per * goodPackets;
  const n = `${goodPackets} packet${goodPackets === 1 ? "" : "s"}`;
  const status: ProfitStatus = per === 0 ? "BREAK_EVEN" : per > 0 ? "PROFIT" : "LOSS";
  const message =
    status === "LOSS"
      ? `Warning: Selling price is ${fmtInr(-per / 100)} below production cost per packet. Estimated loss for ${n}: ${fmtInr(-total / 100)}.`
      : status === "BREAK_EVEN"
      ? "Break-even"
      : `Estimated profit ${fmtInr(per / 100)} per packet · ${fmtInr(total / 100)} for ${n}`;
  return { perPacket: per / 100, total: total / 100, status, message };
}
