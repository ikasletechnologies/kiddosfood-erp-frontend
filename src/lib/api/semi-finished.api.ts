import api from './base';

export interface SemiFinishedLot {
  id: string; inventoryItemId: string; productBatchId: string | null;
  familyId: string; familyCode: string; productName: string; lotNumber: string; sourceBatchCode: string | null;
  sourceType: 'MANUFACTURED' | 'PURCHASE'; warehouse: { id: string; name: string } | null;
  originalQty: number; packagedQty: number; remainingQty: number; reservedQty: number; availableQty: number; unit: string;
  unitCost?: number | null; remainingValue?: number | null; productionDate: string | null; expiryDate: string | null;
  expiryStatus: string; status: string; supplier: string | null; purchaseOrderId: string | null; purchaseOrderNumber: string | null;
  goodsReceiptId: string | null; franchiseId: string | null; packagingUrl: string | null; unreleased: boolean;
}
export interface SemiFinishedInventory {
  rows: SemiFinishedLot[];
  summary: { productFamilies: number; availableByUnit: Record<string, number>; activeLots: number; manufacturedByUnit: Record<string, number>; purchasedByUnit: Record<string, number>; expiringSoonLots: number };
  warehouses: Array<{ id: string; name: string }>; showCost: boolean;
}
export const semiFinishedApi = {
  list: (params?: { search?: string; warehouseId?: string; sourceType?: string; expiryStatus?: string }) => api.get<SemiFinishedInventory>('/api/inventory/semi-finished', { params }),
  getLot: (id: string) => api.get<SemiFinishedLot>(`/api/inventory/semi-finished/${encodeURIComponent(id)}`),
};
