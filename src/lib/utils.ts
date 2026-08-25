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

