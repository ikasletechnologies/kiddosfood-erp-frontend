// Production-only feature flags for the simplified production workflow
// (Planning -> Production Runs -> Packaging & Confirmation -> Stock Hub).
//
// Hidden modules are NOT deleted — their pages, components and APIs are all
// still in the codebase. Set the matching env var to "true" to bring one back
// into the navigation and the production flow. Keep these in sync with the
// backend's PRODUCTION_QC_ENABLED / PRODUCTION_LABELS_ENABLED /
// PRODUCTION_RECALL_ENABLED (see backend src/modules/production/production.flags.ts),
// which enforce the same switches server-side.
//
// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced
// literally (no dynamic process.env[name] lookup).
function flag(raw: string | undefined, defaultValue = false): boolean {
  if (raw === undefined || raw.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export const PRODUCTION_FEATURES = {
  /** Production batch QC inspection (Production > QC). */
  qc: flag(process.env.NEXT_PUBLIC_PRODUCTION_QC_ENABLED),
  /** Labels & Barcodes + the separate Packaging Queue / Confirm Packaging two-step flow. */
  labels: flag(process.env.NEXT_PUBLIC_PRODUCTION_LABELS_ENABLED),
  /** Batch Recall — an independent food-safety module, ON by default ("false" hides it). */
  recall: flag(process.env.NEXT_PUBLIC_PRODUCTION_RECALL_ENABLED, true),
};

/** ProductBatch.qcStatus for a batch released to packaging with production QC switched off. */
export const QC_NOT_REQUIRED = "QC_NOT_REQUIRED";

/** qcStatus values whose quantity can be packaged. */
export const PACKAGEABLE_QC_STATUSES = ["APPROVED", "PARTIALLY_APPROVED", QC_NOT_REQUIRED];

type BatchLike = {
  qcStatus?: string | null;
  packagingStatus?: string | null;
  quantity?: number | null;
  approvedQty?: number | null;
  packagedQty?: number | null;
  expiryDate?: string | null;
  expiryStatus?: string | null;
  recall?: { status: string } | null;
  production?: { status?: string | null } | null;
  packagings?: Array<{ status: string; totalWeight: number }>;
};

/**
 * Why a batch can't be packed right now, or null if it can. With production
 * QC off, a completed batch still at PENDING (finished before QC was switched
 * off) is packable directly — the server releases it inside the same Confirm
 * Packaging transaction. Mirrors ProductionService.autoReleaseBlocker.
 */
export function packagingBlocker(b: BatchLike): string | null {
  const qc = b.qcStatus || "PENDING";
  if (b.packagingStatus === "PACKAGED") return "Fully packed";
  if (b.recall && (b.recall.status === "IN_PROGRESS" || b.recall.status === "COMPLETED")) return "Under recall";
  if (PACKAGEABLE_QC_STATUSES.includes(qc)) return null;
  if (qc !== "PENDING") return "QC rejected";
  if (PRODUCTION_FEATURES.qc) return "Pending QC";
  if (b.production?.status && b.production.status !== "COMPLETED") return "Run not completed";
  const expired = b.expiryStatus === "EXPIRED" || (!!b.expiryDate && new Date(b.expiryDate).getTime() < Date.now());
  if (expired) return "Expired";
  if (!((b.quantity || 0) > 0)) return "Nothing produced";
  return null;
}

/** Unpacked quantity of a batch, in its recipe's yield unit. */
export function packableQty(b: BatchLike): number {
  if (b.packagingStatus === "PACKAGED") return 0;
  const released = PACKAGEABLE_QC_STATUSES.includes(b.qcStatus || "") ? b.approvedQty ?? 0 : b.quantity ?? 0;
  const pending = (b.packagings || [])
    .filter((p) => p.status === "AWAITING_CONFIRMATION")
    .reduce((s, p) => s + (p.totalWeight || 0), 0);
  return Math.max(0, released - (b.packagedQty ?? 0) - pending);
}

/**
 * Business stage of a production batch, mapped from existing backend fields
 * (no new database statuses):
 *   PLANNED -> IN_PROGRESS -> COMPLETED -> READY_FOR_PACKAGING -> PACKAGING_COMPLETED -> STOCK_UPDATED
 * Finished-goods stock is credited in the same transaction that confirms
 * packaging, so a fully packaged batch is also STOCK_UPDATED.
 */
export function getBatchStage(batch: BatchLike): {
  key: "AWAITING_QC" | "READY_FOR_PACKAGING" | "PARTIALLY_PACKED" | "STOCK_UPDATED" | "REJECTED" | "BLOCKED";
  label: string;
} {
  if (batch.packagingStatus === "PACKAGED") return { key: "STOCK_UPDATED", label: "Packed · In Stock" };
  const blocker = packagingBlocker(batch);
  if (blocker === "QC rejected") return { key: "REJECTED", label: "QC Rejected" };
  if (blocker === "Pending QC") return { key: "AWAITING_QC", label: "Pending QC" };
  if (blocker) return { key: "BLOCKED", label: blocker };
  return batch.packagingStatus === "PARTIALLY_PACKED"
    ? { key: "PARTIALLY_PACKED", label: "Partially Packed" }
    : { key: "READY_FOR_PACKAGING", label: "Ready for Packaging" };
}
