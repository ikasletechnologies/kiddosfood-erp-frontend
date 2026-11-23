export const RECEIPT_READY_PO_STATUSES = ["PENDING_APPROVAL", "APPROVED", "ORDERED", "SENT", "PARTIALLY_RECEIVED"];
export function canReceivePO(po: { status: string; canReceive?: boolean; totalItemsCount?: number; receivedItemsCount?: number }) {
  if (!RECEIPT_READY_PO_STATUSES.includes(po.status)) return false;
  if (typeof po.canReceive === "boolean") return po.canReceive;
  return po.totalItemsCount === undefined || po.totalItemsCount > (po.receivedItemsCount || 0) + 0.0001;
}
export function poStatusLabel(status: string) {
  if (status === "APPROVED" || status === "PENDING_APPROVAL") return "Ready for Receipt";
  if (status === "RECEIVED") return "Fully Received";
  return status.split("_").map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}

/**
 * Ordered / pending totals of a PO from its own lines. `pendingQty` is the
 * server-maintained balance (GRN post / return / short-close); `pending` is
 * `null` when any line lacks it (older server) and the caller must ask the
 * remaining-quantity API instead.
 */
export function poQtyTotals(po: { poItems?: Array<{ quantity?: number | null; pendingQty?: number | null }> | null }): { ordered: number; pending: number | null } {
  const lines = po.poItems || [];
  const ordered = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  if (lines.length === 0 || lines.some(l => typeof l.pendingQty !== "number")) return { ordered, pending: null };
  return { ordered, pending: lines.reduce((s, l) => s + Math.max(0, Number(l.pendingQty) || 0), 0) };
}
