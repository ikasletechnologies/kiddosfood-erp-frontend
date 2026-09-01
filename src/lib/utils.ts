import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "₹") {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  return `${isNegative ? '-' : ''}${currency}${absVal.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(absVal) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

// The single source of truth for how a date is displayed anywhere in the
// UI: strict DD/MM/YYYY, always — built manually (not via toLocaleDateString)
// so it can never drift with the browser's OS locale or Intl implementation.
// Every screen previously picked its own format (bare toLocaleDateString(),
// "en-IN" with no options, "en-US", "25 Aug 2026"-style options, ...) —
// this replaces all of them.
export function formatDate(date: string | number | Date | null | undefined): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Same DD/MM/YYYY date, plus a locale-formatted time — for the handful of
// places that show both together (e.g. "Generated on 25/08/2026 at 02:30 PM").
export function formatDateTime(date: string | number | Date | null | undefined): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(d)} ${time}`;
}

export function formatERPNumber(
  prefix: "PO" | "GRN" | "BT" | "DC" | "INV" | "RCPT" | "PRD",
  idOrCode: string | number | undefined,
  dateStr?: string
): string {
  if (!idOrCode) {
    const defaultYear = dateStr ? new Date(dateStr).getFullYear() : 2026;
    return `${prefix}-${defaultYear}-0000`;
  }
  
  const str = String(idOrCode);

  // Already a well-formed ERP number (e.g. PO-2026-0001, or PO-2026-17009 once
  // a sequence has grown past 4 digits) — return it as-is. This used to only
  // pass through an EXACT 4-digit sequence and otherwise reformat via
  // `.slice(-4)`, which truncated any longer sequence down to its last 4
  // digits — e.g. INV-2026-17009 rendered as INV-2026-7009, identical to the
  // real INV-2026-7009. Two genuinely distinct, uniquely-stored invoice
  // numbers then looked like duplicates in the UI. A real, already-correct
  // number must never be reformatted/truncated — only a raw id lacking this
  // shape (handled below) needs a display suffix synthesized for it.
  const generalRegex = new RegExp(`^${prefix}-\\d{4}-\\d+$`);
  if (generalRegex.test(str)) {
    return str;
  }

  // Extract or generate a 4-digit suffix from the input
  let suffix = "0001";
  if (typeof idOrCode === "number") {
    suffix = String(idOrCode).padStart(4, "0");
  } else {
    // Check if there are digits at the end of the string
    const digitMatch = str.match(/\d+$/);
    if (digitMatch) {
      suffix = digitMatch[0].padStart(4, "0").slice(-4);
    } else {
      // Create a deterministic hash from the UUID/string
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      suffix = String(Math.abs(hash) % 10000).padStart(4, "0");
    }
  }
  
  const year = dateStr ? new Date(dateStr).getFullYear() : 2026;
  return `${prefix}-${year}-${suffix}`;
}

// ── Canonical Monetary Precision & Calculations ────────────────────────────────

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export interface CalculationLineItem {
  quantity?: number;
  qty?: number;
  rate?: number;
  price?: number;
  discountPercent?: number;
  discountPct?: number;
  discountAmount?: number;
  discount?: number;
  taxPercent?: number;
  taxPct?: number;
  gstRate?: number;
}

export interface DocumentCalculationResult {
  computedItems: Array<{
    grossAmount: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  subTotal: number;         // Post-discount taxable total sum
  totalDiscount: number;    // Total discount sum
  totalTax: number;         // Total tax sum
  totalBeforeRound: number; // subTotal + totalTax
  roundOff: number;         // Signed round-off adjustment
  finalTotal: number;       // Grand total payable
}

export function calculateSalesDocumentTotals(
  items: CalculationLineItem[],
  priceMode: "with_tax" | "without_tax" = "without_tax",
  roundOffEnabled: boolean = true,
  documentDiscountAmount: number = 0
): DocumentCalculationResult {
  let subTotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  const validItems = items || [];
  const totalGross = validItems.reduce((sum, item) => {
    const q = Number(item.quantity ?? item.qty ?? 0);
    const r = Number(item.rate ?? item.price ?? 0);
    return sum + roundMoney(q * r);
  }, 0);

  const hasExplicitItemDiscounts = validItems.some((item) =>
    (item.discountAmount !== undefined && Number(item.discountAmount) > 0) ||
    (item.discount !== undefined && Number(item.discount) > 0) ||
    (item.discountPercent !== undefined && Number(item.discountPercent) > 0) ||
    (item.discountPct !== undefined && Number(item.discountPct) > 0)
  );

  const computedItems = validItems.map((item) => {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const rate = Number(item.rate ?? item.price ?? 0);
    const grossAmount = roundMoney(qty * rate);

    const discountPct = Number(item.discountPercent ?? item.discountPct ?? 0);
    let discAmt = item.discountAmount !== undefined && Number(item.discountAmount) > 0
      ? Number(item.discountAmount)
      : (item.discount !== undefined && Number(item.discount) > 0 ? Number(item.discount) : 0);

    if (!hasExplicitItemDiscounts && documentDiscountAmount > 0 && totalGross > 0) {
      discAmt = roundMoney(documentDiscountAmount * (grossAmount / totalGross));
    } else if (!discAmt && discountPct > 0) {
      discAmt = roundMoney(grossAmount * (discountPct / 100));
    }

    const taxableAmount = roundMoney(Math.max(0, grossAmount - discAmt));
    const taxPct = Number(item.taxPercent ?? item.taxPct ?? item.gstRate ?? 0);

    let taxAmount = 0;
    let lineTotal = 0;

    if (priceMode === "with_tax" && taxPct > 0) {
      taxAmount = roundMoney(taxableAmount * taxPct / (100 + taxPct));
      lineTotal = taxableAmount;
      const baseTaxable = roundMoney(taxableAmount - taxAmount);
      subTotal += baseTaxable;
    } else {
      taxAmount = roundMoney(taxableAmount * taxPct / 100);
      lineTotal = roundMoney(taxableAmount + taxAmount);
      subTotal += taxableAmount;
    }

    totalTax += taxAmount;
    totalDiscount += discAmt;

    return {
      grossAmount,
      discountAmount: discAmt,
      taxableAmount,
      taxAmount,
      lineTotal
    };
  });

  subTotal = roundMoney(subTotal);
  totalTax = roundMoney(totalTax);
  totalDiscount = roundMoney(totalDiscount);

  const totalBeforeRound = roundMoney(subTotal + totalTax);
  const roundOff = roundOffEnabled ? roundMoney(Math.round(totalBeforeRound) - totalBeforeRound) : 0;
  const finalTotal = roundMoney(totalBeforeRound + roundOff);

  return {
    computedItems,
    subTotal,
    totalDiscount,
    totalTax,
    totalBeforeRound,
    roundOff,
    finalTotal
  };
}

