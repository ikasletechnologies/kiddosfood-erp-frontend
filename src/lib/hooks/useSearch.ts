"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS, searchParam } from "@/lib/search";

/** Returns `value` once it has stopped changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Debounced, trimmed search term for server-side search. Inner/outer
 * whitespace changes do not produce a new term, so typing a trailing space
 * (or retyping the same text) does not fire a duplicate request.
 */
export function useSearchTerm(raw: string, delay: number = SEARCH_DEBOUNCE_MS): string {
  return useDebouncedValue(searchParam(raw) ?? "", delay);
}

/**
 * Guards against stale responses: call `begin()` before a request and only
 * apply its result while `isLatest()` is still true. A newer request (or
 * unmount) makes every older one stale, so a slow earlier response can never
 * overwrite newer results.
 */
export function useLatestRequest() {
  const seq = useRef(0);
  useEffect(() => () => { seq.current++; }, []);
  return useCallback(() => {
    const id = ++seq.current;
    return { isLatest: () => id === seq.current };
  }, []);
}

export interface AsyncSearchOptions<T> {
  /** Raw text from the input. */
  query: string;
  /** Fetches results for the trimmed query. */
  fetcher: (query: string) => Promise<T[]>;
  /** When false nothing is fetched (e.g. dropdown closed). Default true. */
  enabled?: boolean;
  /** Minimum trimmed length before searching. Default 1; 0 searches on empty input too. */
  minLength?: number;
  debounceMs?: number;
}

/**
 * Debounced server-side search with stale-response protection and
 * duplicate-request suppression (the same trimmed query is fetched once
 * until `refresh()` is called).
 */
export function useAsyncSearch<T>({ query, fetcher, enabled = true, minLength = 1, debounceMs = SEARCH_DEBOUNCE_MS }: AsyncSearchOptions<T>) {
  const term = useSearchTerm(query, debounceMs);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const begin = useLatestRequest();
  const lastKey = useRef<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Typed text differs from what was last searched -> a search is pending.
  const pending = enabled && (searchParam(query) ?? "") !== term;

  useEffect(() => {
    if (!enabled) return;
    if (term.length < minLength) {
      lastKey.current = null;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const key = `${term}\u0000${nonce}`;
    if (lastKey.current === key) return; // duplicate request
    lastKey.current = key;
    const req = begin();
    setLoading(true);
    setError(null);
    fetcherRef.current(term)
      .then(rows => { if (req.isLatest()) setResults(Array.isArray(rows) ? rows : []); })
      .catch(err => {
        if (!req.isLatest()) return;
        lastKey.current = null; // allow a retry of the same query
        setResults([]);
        setError(err?.response?.data?.error || err?.message || "Search failed");
      })
      .finally(() => { if (req.isLatest()) setLoading(false); });
  }, [term, enabled, minLength, nonce, begin]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  return { term, results, loading: loading || (pending && (searchParam(query) ?? "").length >= minLength), error, refresh };
}
