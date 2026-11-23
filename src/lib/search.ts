// Shared search behaviour for every search bar / autocomplete in the app.
// One place for: debounce timing, the user-facing status texts, query
// normalisation (trimmed + case-insensitive) and de-duplication.

/** Debounce for search-driven API calls (spec: 250–300 ms). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Loading text shown while a search request is in flight. */
export const SEARCHING_TEXT = "Searching…";

/** Text shown when a search returned nothing. */
export const NO_MATCH_TEXT = "No matching records found";

/** Trim, collapse inner whitespace and lower-case a search query. */
export function normalizeSearch(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

/** Trimmed query to send to the server (case is left to the backend, which matches case-insensitively). */
export function searchParam(value: unknown): string | undefined {
  const q = value === null || value === undefined ? "" : String(value).trim().replace(/\s+/g, " ");
  return q ? q : undefined;
}

/**
 * True when `query` is empty, or when any of `fields` contains it
 * (trimmed, case-insensitive). Null / undefined fields are ignored.
 */
export function matchesSearch(query: unknown, ...fields: unknown[]): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return fields.some(f => f !== null && f !== undefined && normalizeSearch(f).includes(q));
}

/** Keep the first item for every key; items without a key are kept as-is. */
export function dedupeBy<T>(items: readonly T[], key: (item: T) => string | number | null | undefined): T[] {
  const seen = new Set<string | number>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (k === null || k === undefined || k === "") {
      out.push(item);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** De-duplicate records by their database id. */
export function dedupeById<T extends { id?: string | number | null }>(items: readonly T[]): T[] {
  return dedupeBy(items, i => i?.id ?? null);
}

/** Compact quantity formatting for suggestion rows (max 3 decimals, no trailing zeros). */
export function formatQty(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 1000) / 1000);
}
