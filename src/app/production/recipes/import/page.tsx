"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { toast } from "react-hot-toast";
import { ArrowLeft, Check, ChevronRight, FileText, History, RefreshCw, Search, SkipForward, Undo2, Upload, AlertTriangle } from "lucide-react";
import { productsApi, recipeImportsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  ISSUE_LABEL, ImportedRecipe, MATCH_LABEL, QTY_UNITS, RecipeDraft, draftProblems, initialDraft, toDecision,
} from "@/lib/recipe-import";

type ImportSession = { id: string; fileName: string; createdAt: string; updatedAt: string; total: number; imported: number; pending: number; skipped: number };

type Review = {
  session: { id: string; fileName: string; createdAt: string; updatedAt: string };
  summary: { recipes: number; pending: number; imported: number; unchanged: number; skipped: number; ingredientLines: number; unmatchedLines: number; flaggedLines: number };
  recipes: ImportedRecipe[];
  materials: Array<{ id: string; name: string; unit: string; sku: string | null }>;
};

const FILTERS = ["All", "Needs review", "Ready", "Imported", "Skipped"] as const;
type Filter = (typeof FILTERS)[number];

const input = "h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 text-xs font-medium text-gray-800 dark:text-white outline-none focus:border-[#f58220]";
const card = "bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl";

const STATE_CHIP: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-slate-300",
  IMPORTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  UNCHANGED: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  SKIPPED: "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-slate-500 line-through",
};
const MATCH_CHIP: Record<string, string> = {
  EXACT: "text-emerald-700 dark:text-emerald-400",
  LEARNED: "text-emerald-700 dark:text-emerald-400",
  ALIAS: "text-sky-700 dark:text-sky-400",
  FUZZY: "text-amber-700 dark:text-amber-400",
  UNMATCHED: "text-rose-600 dark:text-rose-400",
  AMBIGUOUS: "text-amber-700 dark:text-amber-400",
};

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const IMPORT_PATH = "/production/recipes/import";
const HISTORY_PATH = `${IMPORT_PATH}?view=history`;
const reviewPath = (id: string) => `${IMPORT_PATH}?importId=${encodeURIComponent(id)}`;
const errorText = (e: any, fallback: string) => e?.response?.data?.error || fallback;

export default function RecipeImportPage() {
  return (
    <Suspense fallback={null}>
      <RecipeImport />
    </Suspense>
  );
}

/**
 * One page, three URL-driven views:
 *   /production/recipes/import                 → upload a new document (plus recent imports)
 *   /production/recipes/import?view=history    → Recent Imports only (opened from Recipe Master)
 *   /production/recipes/import?importId=<id>   → saved review of one document (survives refresh / Back)
 */
function RecipeImport() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importId = searchParams.get("importId") || "";
  const historyView = !importId && searchParams.get("view") === "history";

  const fileRef = useRef<HTMLInputElement>(null);
  const loadedId = useRef("");
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [lastViewedId, setLastViewedId] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RecipeDraft>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    setSessionsError("");
    recipeImportsApi.list()
      .then((res) => setSessions(res.data || []))
      .catch((e) => setSessionsError(errorText(e, "Could not load import history.")))
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    loadSessions();
    productsApi.getAll().then((res) => setProducts(res.data || [])).catch(() => {});
  }, [loadSessions]);

  /** Loads a review; drafts the operator hasn't edited are rebuilt (to pick up learned matches). */
  const applyReview = useCallback((data: Review, keepTouched: Set<string>) => {
    setReview(data);
    setDrafts((prev) => {
      const next: Record<string, RecipeDraft> = {};
      data.recipes.forEach((r) => { next[r.key] = keepTouched.has(r.key) && prev[r.key] ? prev[r.key] : initialDraft(r); });
      return next;
    });
    setSelectedKey((k) => (k && data.recipes.some((r) => r.key === k) ? k : data.recipes[0]?.key || ""));
  }, []);

  // The URL decides which import is open, so refresh and browser Back both work.
  useEffect(() => {
    if (!importId) {
      loadedId.current = "";
      setReview(null);
      setReviewError("");
      return;
    }
    setLastViewedId(importId);
    if (loadedId.current === importId) return;
    let cancelled = false;
    setReview(null);
    setReviewError("");
    recipeImportsApi.review(importId)
      .then((res) => {
        if (cancelled) return;
        loadedId.current = importId;
        setTouched(new Set());
        setFilter("All");
        setSearch("");
        applyReview(res.data, new Set());
      })
      .catch((e) => { if (!cancelled) setReviewError(errorText(e, "Could not open the import.")); });
    return () => { cancelled = true; };
  }, [importId, applyReview]);

  const openSession = (id: string) => router.push(reviewPath(id));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) return toast.error("Choose a Word .docx file.");
    if (file.size > 10 * 1024 * 1024) return toast.error("The file is larger than 10 MB.");
    setUploading(true);
    try {
      const res = await recipeImportsApi.upload(file.name, await fileToBase64(file));
      setTouched(new Set());
      applyReview(res.data, new Set());
      loadedId.current = res.data.session.id;
      router.push(reviewPath(res.data.session.id));
      toast.success(res.data.resumed ? "Same document as before — resumed its review." : `${res.data.summary.recipes} recipes extracted. Review each before importing.`);
      loadSessions();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Could not read the document.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const recipes = review?.recipes || [];
  const problemsOf = useCallback((r: ImportedRecipe) => (drafts[r.key] ? draftProblems(drafts[r.key], r) : []), [drafts]);
  const shown = useMemo(() => recipes.filter((r) => {
    if (search && !`${r.title} ${r.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    const pending = r.status.state === "PENDING";
    if (filter === "Needs review") return pending && problemsOf(r).length > 0;
    if (filter === "Ready") return pending && problemsOf(r).length === 0;
    if (filter === "Imported") return r.status.state === "IMPORTED" || r.status.state === "UNCHANGED";
    if (filter === "Skipped") return r.status.state === "SKIPPED";
    return true;
  }), [recipes, filter, search, problemsOf]);

  const selected = recipes.find((r) => r.key === selectedKey) || null;
  const draft = selected ? drafts[selected.key] : null;
  const setDraft = (patch: Partial<RecipeDraft>) => {
    if (!selected) return;
    setTouched((t) => new Set(t).add(selected.key));
    setDrafts((d) => ({ ...d, [selected.key]: { ...d[selected.key], ...patch } }));
  };
  const setLine = (index: number, patch: Partial<RecipeDraft["lines"][number]>) =>
    draft && setDraft({ lines: draft.lines.map((l) => (l.index === index ? { ...l, ...patch } : l)) });

  const refresh = async (keep: Set<string>) => {
    if (!review) return;
    const res = await recipeImportsApi.review(review.session.id);
    applyReview(res.data, keep);
  };

  const confirm = async () => {
    if (!selected || !draft || !review) return;
    const problems = draftProblems(draft, selected);
    if (problems.length) return toast.error(problems[0]);
    setBusy(true);
    try {
      const res = await recipeImportsApi.confirm(review.session.id, selected.key, toDecision(draft));
      const s = res.data.status;
      toast.success(s.state === "UNCHANGED" ? s.message : `Imported "${draft.name}" as formulation v${s.version}.${res.data.expenses === "DEFAULTS_APPLIED" ? " Default Additional Expenses (₹5/packet) added — edit them in Recipe Master." : ""}`);
      if (res.data.createdMaterials?.some((m: any) => !m.reused)) toast.success(`New raw material${res.data.createdMaterials.length > 1 ? "s" : ""} added: ${res.data.createdMaterials.filter((m: any) => !m.reused).map((m: any) => m.name).join(", ")}`);
      const keep = new Set(touched);
      keep.delete(selected.key);
      setTouched(keep);
      await refresh(keep);
      // Move on to the next pending recipe.
      const next = recipes.find((r) => r.key !== selected.key && r.status.state === "PENDING");
      if (next) setSelectedKey(next.key);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleSkip = async (skip: boolean) => {
    if (!selected || !review) return;
    setBusy(true);
    try {
      await recipeImportsApi.skip(review.session.id, selected.key, skip);
      await refresh(touched);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Could not update the recipe.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-6 space-y-4 w-full min-w-0">
      <header className={clsx(card, "p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3")}>
        <div className="min-w-0">
          <Link href={importId ? HISTORY_PATH : "/production/recipes"} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-[#f58220]">
            <ArrowLeft size={12} /> {importId ? "Recent Imports" : "Recipes"}
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
            {historyView ? "Recent Imports" : importId ? "Recipe Import Review" : "Import Recipes from Word"}
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {historyView
              ? "Previously uploaded Word documents and their saved review. Opening one never re-uploads or re-processes it."
              : "Extracts recipes, ingredient quantities and output yields. Nothing is saved until you confirm each recipe. Stock and product prices are never changed."}
          </p>
        </div>
        {historyView ? (
          <Link
            href={IMPORT_PATH}
            className="flex items-center gap-1.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-slate-200 px-3.5 py-2 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap"
          >
            <Upload size={14} /> Import from Word
          </Link>
        ) : (
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-3.5 py-2 rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Reading…" : "Upload .docx"}
          </button>
        </div>
        )}
      </header>

      {!importId && (
        <ImportHistory
          sessions={sessions}
          loading={sessionsLoading}
          error={sessionsError}
          highlightId={lastViewedId}
          onRetry={loadSessions}
          onOpen={openSession}
        />
      )}

      {importId && !review && (
        <div className={clsx(card, "p-6 text-xs flex flex-wrap items-center gap-3")}>
          {reviewError ? (
            <>
              <AlertTriangle size={14} className="text-rose-500 shrink-0" />
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{reviewError}</span>
              <Link href={HISTORY_PATH} className="text-[#f58220] font-semibold hover:underline">Back to Recent Imports</Link>
            </>
          ) : (
            <span className="flex items-center gap-2 text-gray-400"><RefreshCw size={14} className="animate-spin" /> Loading saved import…</span>
          )}
        </div>
      )}

      {review && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              ["Recipes", review.summary.recipes],
              ["Pending", review.summary.pending],
              ["Imported", review.summary.imported],
              ["Unchanged", review.summary.unchanged],
              ["Skipped", review.summary.skipped],
              ["Unmatched lines", review.summary.unmatchedLines],
              ["Flagged lines", review.summary.flaggedLines],
            ].map(([label, value]) => (
              <div key={label as string} className={clsx(card, "px-3 py-2")}>
                <p className="text-[10px] font-bold uppercase text-gray-400">{label}</p>
                <p className="text-sm font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
            {/* Recipe list */}
            <div className={clsx(card, "overflow-hidden")}>
              <div className="p-2.5 space-y-2 border-b border-gray-100 dark:border-white/5">
                <p className="text-[11px] font-semibold text-gray-500 truncate" title={review.session.fileName}><FileText size={12} className="inline mr-1" />{review.session.fileName}</p>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipes…" className={clsx(input, "w-full pl-7")} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {FILTERS.map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={clsx("px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer", filter === f ? "bg-[#f58220] text-white" : "text-gray-500 hover:text-gray-800 dark:hover:text-white")}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                {shown.length === 0 && <p className="p-3 text-xs text-gray-400">No recipes here.</p>}
                {shown.map((r) => {
                  const n = r.status.state === "PENDING" ? problemsOf(r).length : 0;
                  return (
                    <button key={r.key} onClick={() => setSelectedKey(r.key)} className={clsx("w-full text-left px-3 py-2 cursor-pointer", r.key === selectedKey ? "bg-orange-50 dark:bg-orange-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate">{r.title}</span>
                        <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0", STATE_CHIP[r.status.state])}>{r.status.state.toLowerCase()}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {r.category || "No section"} · {r.ingredients.length} ingredients
                        {r.status.state === "PENDING" && (n > 0 ? <span className="text-amber-600 font-semibold"> · {n} to review</span> : <span className="text-emerald-600 font-semibold"> · ready</span>)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail */}
            {selected && draft ? (
              <RecipeReview
                recipe={selected}
                draft={draft}
                materials={review.materials}
                products={products}
                busy={busy}
                setDraft={setDraft}
                setLine={setLine}
                onConfirm={confirm}
                onSkip={toggleSkip}
              />
            ) : (
              <div className={clsx(card, "p-6 text-xs text-gray-400")}>Select a recipe to review.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const sessionStatus = (s: ImportSession) =>
  s.total > 0 && s.pending === 0
    ? { label: "Complete", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" }
    : s.imported > 0 || s.skipped > 0
      ? { label: "In progress", cls: "bg-orange-50 text-[#f58220] dark:bg-orange-500/10" }
      : { label: "Not started", cls: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-slate-300" };

function ImportHistory({ sessions, loading, error, highlightId, onRetry, onOpen }: {
  sessions: ImportSession[];
  loading: boolean;
  error: string;
  highlightId: string;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => !q || s.fileName.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sessions, query]);

  return (
    <div className={clsx(card, "overflow-hidden")}>
      <div className="p-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-white/5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
          <History size={14} className="text-[#f58220]" /> Recent imports
          {!loading && !error && <span className="text-gray-400 font-semibold">({sessions.length})</span>}
        </p>
        <div className="relative w-full sm:w-64">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by document name…" className={clsx(input, "w-full pl-7")} aria-label="Search imports by document name" />
        </div>
      </div>

      {loading ? (
        <p className="p-4 flex items-center gap-2 text-xs text-gray-400"><RefreshCw size={14} className="animate-spin" /> Loading import history…</p>
      ) : error ? (
        <div className="p-4 flex flex-wrap items-center gap-3 text-xs">
          <AlertTriangle size={14} className="text-rose-500 shrink-0" />
          <span className="text-rose-600 dark:text-rose-400 font-semibold">{error}</span>
          <button onClick={onRetry} className="text-[#f58220] font-semibold hover:underline cursor-pointer">Try again</button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-6 text-center">
          <FileText size={22} className="mx-auto text-gray-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mt-2">No imports yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Upload MEASUREMENTS.docx (or another recipe document) from Import from Word to begin.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-4 text-xs text-gray-400">No documents match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-gray-400 border-b border-gray-100 dark:border-white/5">
                <th className="text-left px-3 py-2">Document</th>
                <th className="text-left px-3 py-2">Imported on</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Recipes</th>
                <th className="text-right px-3 py-2">Imported</th>
                <th className="text-right px-3 py-2">Pending</th>
                <th className="text-right px-3 py-2">Skipped</th>
                <th className="px-3 py-2"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((s) => {
                const status = sessionStatus(s);
                return (
                  <tr
                    key={s.id}
                    onClick={() => onOpen(s.id)}
                    className={clsx("cursor-pointer", s.id === highlightId ? "bg-orange-50 dark:bg-orange-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]")}
                  >
                    <td className="px-3 py-2 max-w-[260px]">
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-gray-400 shrink-0" />
                        <span className="font-semibold truncate" title={s.fileName}>{s.fileName}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                    <td className="px-3 py-2"><span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap", status.cls)}>{status.label}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{s.imported}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{s.pending}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{s.skipped}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpen(s.id); }}
                        className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#f58220] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        View details <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecipeReview({ recipe: r, draft: d, materials, products, busy, setDraft, setLine, onConfirm, onSkip }: {
  recipe: ImportedRecipe;
  draft: RecipeDraft;
  materials: Review["materials"];
  products: any[];
  busy: boolean;
  setDraft: (patch: Partial<RecipeDraft>) => void;
  setLine: (index: number, patch: Partial<RecipeDraft["lines"][number]>) => void;
  onConfirm: () => void;
  onSkip: (skip: boolean) => void;
}) {
  const [productSearch, setProductSearch] = useState("");
  const pending = r.status.state === "PENDING";
  const problems = pending ? draftProblems(d, r) : [];
  const existing = r.existingRecipes.find((x) => x.id === d.existingRecipeId) || r.existingRecipes[0];
  const matName = (id: string) => materials.find((m) => m.id === id)?.name || "";
  const suggestedIds = new Set(r.products.map((p) => p.id));
  const extraProducts = productSearch.trim().length >= 2
    ? products.filter((p) => !suggestedIds.has(p.id) && `${p.name} ${p.sku}`.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8)
    : [];
  const shownProducts = [
    ...r.products,
    ...products.filter((p) => d.productIds.includes(p.id) && !suggestedIds.has(p.id)).map((p) => ({ ...p, reason: "Added", linkedRecipeId: null, linkedRecipeName: null })),
  ];
  const toggleProduct = (id: string) => setDraft({ productIds: d.productIds.includes(id) ? d.productIds.filter((x) => x !== id) : [...d.productIds, id] });

  return (
    <div className={clsx(card, "overflow-hidden")}>
      <div className="p-4 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase text-gray-400">{r.category || "No section"} · as written in the document</p>
          <h2 className="text-sm font-bold">{r.title}</h2>
          {r.status.state !== "PENDING" && (
            <p className="text-[11px] mt-1 text-gray-500">
              {r.status.state === "SKIPPED" ? "Skipped — not imported." : r.status.message || `Imported as formulation v${r.status.version}.`}
              {r.status.recipeId && <> · <Link className="text-[#f58220] font-semibold hover:underline" href={`/production?recipeId=${r.status.recipeId}`}>Open in Production Planning</Link></>}
            </p>
          )}
        </div>
        <span className={clsx("text-[10px] font-bold px-2 py-1 rounded", STATE_CHIP[r.status.state])}>{r.status.state.toLowerCase()}</span>
      </div>

      <fieldset disabled={!pending || busy} className="p-4 space-y-4">
        {/* Existing recipe protection */}
        {r.existingRecipes.length > 0 && (
          <section className="rounded-lg border border-sky-200 dark:border-sky-500/20 bg-sky-50/50 dark:bg-sky-500/5 p-3 space-y-2">
            <p className="text-xs font-bold text-sky-800 dark:text-sky-300">A recipe with this name already exists — it will not be overwritten.</p>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <label className="flex items-center gap-1.5"><input type="radio" checked={d.mode === "NEW_VERSION"} onChange={() => setDraft({ mode: "NEW_VERSION", existingRecipeId: d.existingRecipeId || r.existingRecipes[0].id })} /> Update existing recipe (new formulation version)</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={d.mode === "CREATE"} onChange={() => setDraft({ mode: "CREATE" })} /> Create a separate recipe</label>
            </div>
            {d.mode === "NEW_VERSION" && (
              <label className="flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-slate-300">
                <input type="checkbox" className="mt-0.5" checked={!!d.replaceExpenses} onChange={(e) => setDraft({ replaceExpenses: e.target.checked })} />
                <span>Replace this recipe&apos;s Additional Expenses with the defaults (₹5 per packet). Unticked, its saved expenses are kept; a recipe with none gets the defaults.</span>
              </label>
            )}
            {existing && (
              <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="font-bold text-gray-600 dark:text-slate-300">Existing{existing.activeFormulation ? ` · v${existing.activeFormulation.version} · ${existing.activeFormulation.yieldQty} ${existing.activeFormulation.yieldUnit}${existing.activeFormulation.outputStage ? ` (${existing.activeFormulation.outputStage})` : ""}` : " · no formulation"}</p>
                  <ul className="mt-1 space-y-0.5">{existing.activeFormulation?.items.map((i) => <li key={i.inventoryItemId}>{i.name}: {i.quantity} {i.unit}</li>)}</ul>
                  {existing.productionCount > 0 && <p className="mt-1 text-gray-500">{existing.productionCount} production run(s) keep the version they used.</p>}
                </div>
                <div>
                  <p className="font-bold text-gray-600 dark:text-slate-300">From document · {d.yieldQty} {d.yieldUnit}</p>
                  <ul className="mt-1 space-y-0.5">{d.lines.filter((l) => l.action !== "UNRESOLVED").map((l) => (
                    <li key={l.index}>{(l.action === "MAP" ? matName(l.inventoryItemId) : l.newName) || r.ingredients[l.index].sourceName}: {l.quantity} {l.unit}</li>
                  ))}</ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Recipe Master fields */}
        <section className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">Recipe name</span>
            <input value={d.name} onChange={(e) => setDraft({ name: e.target.value })} disabled={d.mode === "NEW_VERSION"} className={clsx(input, "w-full disabled:opacity-60")} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">Category</span>
            <input value={d.category} onChange={(e) => setDraft({ category: e.target.value })} disabled={d.mode === "NEW_VERSION"} className={clsx(input, "w-full disabled:opacity-60")} />
          </label>
        </section>

        {/* Output stage / reference yield */}
        <section className="space-y-2">
          <p className="text-xs font-bold">Reference output</p>
          {r.outputs.length === 0 ? (
            <p className="text-[11px] font-semibold text-rose-600">The document gives no output for this recipe.</p>
          ) : (
            <div className="space-y-1">
              {r.outputs.map((o, i) => (
                <label key={i} className="flex items-center gap-2 text-xs">
                  <input type="radio" checked={d.outputIndex === i} onChange={() => setDraft({ outputIndex: i, yieldQty: o.quantity != null ? String(o.quantity) : o.qtyText || "", yieldUnit: o.unit || "" })} />
                  <span className="font-semibold">{o.stage}</span>
                  <span className="text-gray-500">— {o.sourceText}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min="0" step="any" value={d.yieldQty} onChange={(e) => setDraft({ yieldQty: e.target.value })} className={clsx(input, "w-28 text-right")} aria-label="Reference output quantity" />
            <select value={d.yieldUnit} onChange={(e) => setDraft({ yieldUnit: e.target.value })} className={input} aria-label="Reference output unit">
              <option value="">Unit…</option>
              {QTY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {r.outputs.length > 1 && (
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                <input type="checkbox" checked={d.stageConfirmed} onChange={(e) => setDraft({ stageConfirmed: e.target.checked })} />
                Production targets the &ldquo;{r.outputs[d.outputIndex]?.stage}&rdquo; output
              </label>
            )}
          </div>
          <p className="text-[10px] text-gray-400">Grams are stored as KG (1534 G = 1.534 KG). All stages listed in the document are kept on the formulation.</p>
        </section>

        {/* Ingredients */}
        <section className="space-y-2">
          <p className="text-xs font-bold">Ingredients <span className="font-normal text-gray-400">— quantities go into the reference formulation, not the Recipe Master form</span></p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[11px]">
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-400 text-left">
                  <th className="py-1 pr-2">From document</th>
                  <th className="py-1 px-2">Qty</th>
                  <th className="py-1 px-2">Unit</th>
                  <th className="py-1 px-2">Action</th>
                  <th className="py-1 pl-2">Raw material</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {r.ingredients.map((ing) => {
                  const l = d.lines.find((x) => x.index === ing.index)!;
                  const cands = ing.match.candidates;
                  return (
                    <tr key={ing.index} className="align-top">
                      <td className="py-1.5 pr-2">
                        <p className="font-semibold text-gray-800 dark:text-white">{ing.sourceName}{ing.group && <span className="font-normal text-gray-400"> · {ing.group}</span>}</p>
                        <p className="text-gray-400">{ing.sourceText}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {ing.issues.map((i) => <span key={i} className="px-1 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[9px]">{ISSUE_LABEL[i] || i}</span>)}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="number" min="0" step="any" value={l.quantity} disabled={l.action === "UNRESOLVED"} onChange={(e) => setLine(ing.index, { quantity: e.target.value })} className={clsx(input, "w-20 text-right disabled:opacity-40")} aria-label={`${ing.sourceName} quantity`} />
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={l.unit} disabled={l.action === "UNRESOLVED"} onChange={(e) => setLine(ing.index, { unit: e.target.value })} className={clsx(input, "disabled:opacity-40")} aria-label={`${ing.sourceName} unit`}>
                          <option value="">—</option>
                          {QTY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={l.action} onChange={(e) => setLine(ing.index, { action: e.target.value as any })} className={input} aria-label={`${ing.sourceName} action`}>
                          <option value="MAP">Use existing material</option>
                          <option value="CREATE">Create new material</option>
                          <option value="UNRESOLVED">Leave unresolved</option>
                        </select>
                      </td>
                      <td className="py-1.5 pl-2">
                        {l.action === "MAP" && (
                          <>
                            <select value={l.inventoryItemId} onChange={(e) => setLine(ing.index, { inventoryItemId: e.target.value })} className={clsx(input, "w-full max-w-[240px]")} aria-label={`${ing.sourceName} material`}>
                              <option value="">Select material…</option>
                              {cands.length > 0 && (
                                <optgroup label="Suggested">
                                  {cands.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.unit}) — {c.reason}</option>)}
                                </optgroup>
                              )}
                              <optgroup label="All raw materials">
                                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                              </optgroup>
                            </select>
                            <p className={clsx("mt-0.5 text-[10px] font-bold", l.inventoryItemId === ing.match.inventoryItemId ? MATCH_CHIP[ing.match.confidence] : "text-gray-500")}>
                              {l.inventoryItemId === ing.match.inventoryItemId ? MATCH_LABEL[ing.match.confidence] : l.inventoryItemId ? "Chosen by you" : MATCH_LABEL[ing.match.confidence]}
                            </p>
                          </>
                        )}
                        {l.action === "CREATE" && (
                          <div className="flex items-center gap-1.5">
                            <input value={l.newName} onChange={(e) => setLine(ing.index, { newName: e.target.value })} className={clsx(input, "w-40")} aria-label="New material name" />
                            <select value={l.newUnit} onChange={(e) => setLine(ing.index, { newUnit: e.target.value })} className={input} aria-label="New material stock unit">
                              <option value="kg">kg</option><option value="L">L</option><option value="pcs">pcs</option>
                            </select>
                          </div>
                        )}
                        {l.action === "UNRESOLVED" && <p className="text-[10px] text-gray-500 pt-1.5">Kept on the formulation for review. Not scaled or deducted.</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Finished goods */}
        <section className="space-y-2">
          <p className="text-xs font-bold">Finished goods made from this recipe <span className="font-normal text-gray-400">— linked only; SKU, price, GST and stock are not changed</span></p>
          {shownProducts.length === 0 && <p className="text-[11px] text-gray-400">No matching finished goods found. Search to link one.</p>}
          <div className="flex flex-wrap gap-1.5">
            {shownProducts.map((p: any) => {
              const taken = !!p.linkedRecipeId;
              return (
                <label key={p.id} className={clsx("flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]", taken ? "opacity-60 border-gray-200 dark:border-white/10" : d.productIds.includes(p.id) ? "border-[#f58220] bg-orange-50 dark:bg-orange-500/10" : "border-gray-200 dark:border-white/10")} title={taken ? `Linked to ${p.linkedRecipeName}` : p.reason}>
                  <input type="checkbox" disabled={taken} checked={d.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-gray-500">{p.sku}</span>
                  {p.basePrice != null && <span className="text-gray-500">₹{p.basePrice}</span>}
                  {taken && <span className="text-gray-400">· linked to {p.linkedRecipeName}</span>}
                </label>
              );
            })}
          </div>
          <div className="relative max-w-xs">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search other finished goods…" className={clsx(input, "w-full pl-7")} />
            {extraProducts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg shadow-lg">
                {extraProducts.map((p) => (
                  <button key={p.id} type="button" onClick={() => { toggleProduct(p.id); setProductSearch(""); }} className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-orange-50 dark:hover:bg-white/5 cursor-pointer">
                    {p.name} <span className="text-gray-500">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {d.mode === "CREATE" && (
          <section className="space-y-1">
            <p className="text-xs font-bold">Instructions / notes</p>
            <textarea value={d.instructions} onChange={(e) => setDraft({ instructions: e.target.value })} rows={2} className={clsx(input, "w-full h-auto py-1.5")} />
          </section>
        )}
      </fieldset>

      {pending && problems.length > 0 && (
        <div className="mx-4 mb-3 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10">
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1"><AlertTriangle size={12} /> Before importing</p>
          <ul className="mt-1 list-disc pl-5 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">{problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-end gap-2">
        {pending && (
          <button onClick={() => onSkip(true)} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer">
            <SkipForward size={13} /> Skip for now
          </button>
        )}
        {r.status.state === "SKIPPED" && (
          <button onClick={() => onSkip(false)} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer">
            <Undo2 size={13} /> Review again
          </button>
        )}
        {pending && (
          <button onClick={onConfirm} disabled={busy || problems.length > 0} className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {busy ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            {d.mode === "NEW_VERSION" ? "Confirm & add new version" : "Confirm & import recipe"}
          </button>
        )}
      </div>
    </div>
  );
}
