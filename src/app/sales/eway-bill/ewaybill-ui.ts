// Shared constants/helpers for the E-Way Bill screens. Codes mirror the NIC
// e-way bill schema (see ERP-backend src/modules/eway-bill/ewaybill.constants.ts).

// Styling tokens — lifted from the Sale Invoice screen (SalesInvoicesClient)
// so E-Way Bills look and behave like it: orange accent, rounded-xl, dark mode.
const INPUT =
  "w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder:text-slate-500 transition-colors disabled:bg-gray-50 dark:disabled:bg-white/[0.02] disabled:text-gray-500";

export const S = {
  page: "min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0",
  pageHeader: "bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0",
  iconTile: "p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0",
  pageTitle: "text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate",
  pageSubtitle: "text-xs text-gray-500 dark:text-slate-400 font-medium truncate",
  container: "max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0",

  card: "bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs w-full min-w-0",
  cardHead: "flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]",
  cardHeadTitle: "text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2",

  formPage: "flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen w-full min-w-0",
  formHeader: "bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs w-full min-w-0",
  formBody: "flex-1 w-full min-w-0",
  formCard: "bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 w-full min-w-0 shadow-2xs",
  formActionBar: "sticky bottom-0 z-10 bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 shrink-0 shadow-2xs w-full min-w-0",

  label: "block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5",
  input: INPUT,
  select: INPUT + " cursor-pointer",

  btnPrimary: "flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
  btnSecondary: "flex items-center justify-center gap-1.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-card text-gray-700 dark:text-slate-200 text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-xl shadow-2xs hover:bg-gray-50 dark:hover:bg-white/5 transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer disabled:opacity-60",
  btnDanger: "flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer",
  btnDangerSolid: "flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer disabled:opacity-60",
  btnIcon: "p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0",
  btnRefresh: "p-2 sm:p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors cursor-pointer shrink-0",
  rowAction: "px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",

  segWrap: "flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full p-0.5 bg-white dark:bg-card shrink-0",
  seg: "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors rounded-lg whitespace-nowrap shrink-0",
  segOn: "bg-[#f58220] text-white shadow-2xs",
  segOff: "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5",

  theadRow: "bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider",
  th: "text-left px-4 py-3",
  td: "px-4 py-3",
  tbody: "divide-y divide-gray-100 dark:divide-white/5",
  tr: "hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors",

  badgeBase: "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap",

  itemsTable: "w-full text-sm border-collapse",
  itemsThRow: "bg-gray-50/75 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider",
  itemsTh: "px-3 py-2.5",
  itemsRow: "border-b border-gray-100 dark:border-white/5 hover:bg-orange-50/20 dark:hover:bg-white/[0.02] group transition-colors",
  itemsTd: "px-1 py-1",
  itemsInput: "w-full text-sm text-gray-700 dark:text-white outline-none bg-transparent px-2 py-1.5 rounded-lg focus:bg-orange-50/40 dark:focus:bg-white/5 placeholder-gray-400 dark:placeholder:text-slate-500 [&>option]:dark:bg-card",
};

export const GST_STATES: { code: number; name: string }[] = [
  [1, "Jammu and Kashmir"], [2, "Himachal Pradesh"], [3, "Punjab"], [4, "Chandigarh"], [5, "Uttarakhand"],
  [6, "Haryana"], [7, "Delhi"], [8, "Rajasthan"], [9, "Uttar Pradesh"], [10, "Bihar"], [11, "Sikkim"],
  [12, "Arunachal Pradesh"], [13, "Nagaland"], [14, "Manipur"], [15, "Mizoram"], [16, "Tripura"],
  [17, "Meghalaya"], [18, "Assam"], [19, "West Bengal"], [20, "Jharkhand"], [21, "Odisha"],
  [22, "Chhattisgarh"], [23, "Madhya Pradesh"], [24, "Gujarat"], [26, "Dadra and Nagar Haveli and Daman and Diu"],
  [27, "Maharashtra"], [29, "Karnataka"], [30, "Goa"], [31, "Lakshadweep"], [32, "Kerala"], [33, "Tamil Nadu"],
  [34, "Puducherry"], [35, "Andaman and Nicobar Islands"], [36, "Telangana"], [37, "Andhra Pradesh"],
  [38, "Ladakh"], [97, "Other Territory"],
].map(([code, name]) => ({ code: code as number, name: name as string }));

export const stateName = (code?: number | null) =>
  GST_STATES.find((s) => s.code === Number(code))?.name || "—";

export const UQC_OPTIONS = [
  "KGS", "GMS", "QTL", "TON", "LTR", "MLT", "NOS", "PCS", "PAC", "BOX", "CTN", "BAG", "BTL", "CAN", "DRM",
  "DOZ", "SET", "UNT", "BDL", "ROL", "TUB", "MTR", "SQF", "SQM", "OTH",
];

export const TRANSACTION_TYPES: Record<string, string> = {
  "1": "Regular",
  "2": "Bill To - Ship To",
  "3": "Bill From - Dispatch From",
  "4": "Combination of 2 and 3",
};

export const SOURCE_LABELS: Record<string, string> = {
  SALE_INVOICE: "Sale Invoice",
  DELIVERY_CHALLAN: "Delivery Challan",
  STOCK_TRANSFER: "Stock Transfer",
  MANUAL: "Manual",
};

export const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10",
  GENERATED: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
  EXPIRED: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
  CANCELLED: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  GENERATED: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export interface Masters {
  subSupplyTypes: Record<string, string>;
  supplyDocMatrix: Record<string, Record<string, string[]>>;
  docTypes: Record<string, string>;
  transModes: Record<string, string>;
  cancelReasons: Record<string, string>;
  vehicleUpdateReasons: Record<string, string>;
  extensionReasons: Record<string, string>;
  threshold: number;
  consignor: any;
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const IST_OFFSET_MS = 330 * 60 * 1000;

// Same rule as the backend: 1 day per 200 km (20 km for ODC), ending at
// 23:59 IST of the last day. Used only for the on-screen preview.
export function previewValidUntil(distanceKm: number, vehicleType: string, start = new Date()): Date | null {
  if (!(distanceKm > 0)) return null;
  const perDay = vehicleType === "O" ? 20 : 200;
  const days = Math.max(1, Math.ceil(distanceKm / perDay));
  const ist = new Date(start.getTime() + IST_OFFSET_MS);
  const endIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, 23, 59, 59, 999);
  return new Date(endIst - IST_OFFSET_MS);
}

export function timeLeft(until?: string | Date | null): string {
  if (!until) return "—";
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

export const apiError = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || fallback;

export function formatEwbNo(n?: string | null) {
  if (!n) return "—";
  return n.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3");
}

export function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// datetime-local value for "now" in the browser's local time
export function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
