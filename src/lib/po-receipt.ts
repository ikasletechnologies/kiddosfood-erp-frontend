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
