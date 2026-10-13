import api from './base';

// --- Products & Recipes ---
export const productsApi = {
  getAll: (params: any = {}) => api.get('/api/products', { params }),
  create: (data: any) => api.post('/api/products', data),
};

export const productsFullApi = {
  getAll: (params: any = {}) => api.get('/api/products', { params }),
  getById: (id: string) => api.get(`/api/products/${id}`),
  create: (data: any) => api.post('/api/products', data),
  update: (id: string, data: any) => api.patch(`/api/products/${id}`, data),
  delete: (id: string) => api.delete(`/api/products/${id}`),
  // Finished Good catalog only — never creates stock (currentStock stays 0).
  // sellingPrice sets Product.basePrice, the only thing POS reads for
  // price — omit it and the product imports at ₹0. Never aborts on one bad
  // row; returns per-row success/duplicate/invalid buckets.
  bulkImport: (rows: Array<{ category?: string; name: string; size?: string; unit?: string; gstPercent?: number; sellingPrice?: number }>) =>
    api.post('/api/products/bulk-import', { rows }),
};

export const recipesApi = {
  getAll: () => api.get('/api/recipes'),
  getById: (id: string) => api.get(`/api/recipes/${id}`),
  getByProduct: (productId: string) => api.get(`/api/recipes/product/${productId}`),
  upsert: (data: any) => api.post('/api/recipes', data),
  calculateCost: (id: string) => api.post(`/api/recipes/${id}/cost`),
  delete: (id: string) => api.delete(`/api/recipes/${id}`),
  getCategories: () => api.get('/api/recipe-categories'),
  createCategory: (name: string) => api.post('/api/recipe-categories', { name }),
  // Versioned reference formulations (reference yield + ingredient quantities)
  getFormulations: (id: string) => api.get(`/api/recipes/${id}/formulations`),
  saveFormulation: (id: string, data: { yieldQty: number; yieldUnit: string; notes?: string; items: { inventoryItemId: string; quantity: number; unit: string }[] }) =>
    api.post(`/api/recipes/${id}/formulations`, data),
};

// --- Raw Materials ---
export const rawMaterialsApi = {
  getAll: (includeInactive = false, franchiseId?: string, excludeCategory?: string) =>
    api.get('/api/raw-materials', { params: { includeInactive, franchiseId, excludeCategory } }),
  getById: (id: string) => api.get(`/api/raw-materials/${id}`),
  getLots: (id: string) => api.get(`/api/raw-materials/${id}/lots`),
  create: (data: any) => api.post('/api/raw-materials', data),
  update: (id: string, data: any) => api.patch(`/api/raw-materials/${id}`, data),
  deactivate: (id: string) => api.patch(`/api/raw-materials/${id}/deactivate`),
  activate: (id: string) => api.patch(`/api/raw-materials/${id}/activate`),
  delete: (id: string) => api.delete(`/api/raw-materials/${id}`),
};

// --- Inventory & Stock ---
export const inventoryApi = {
  getInventory: (franchiseId?: string, category?: string, asOfDate?: string) => api.get('/api/inventory', { params: { franchiseId, category, asOfDate } }),
  getRawMaterialStockSummary: (warehouseId?: string, franchiseId?: string, category?: string) => api.get('/api/inventory/raw-materials/summary', { params: { warehouseId, franchiseId, category } }),
  getRawMaterialConsumption: (params?: any) => {
    const p = typeof params === 'object' && params !== null ? params : { warehouseId: params };
    return api.get('/api/inventory/raw-materials/consumption', { params: p });
  },
  // category omitted = ledger spans every item category (Raw Material,
  // Packaging, Semi-Finished, Finished Good), not just Raw Material.
  getInventoryLedger: (itemId?: string, franchiseId?: string, category?: string) => api.get('/api/inventory/raw-materials/ledger', { params: { itemId, franchiseId, category } }),
  getRawMaterialLedger: (itemId?: string, franchiseId?: string) => api.get('/api/inventory/raw-materials/ledger', { params: { itemId, franchiseId, category: 'RAW_MATERIAL' } }),
  getItem: (id: string) => api.get(`/api/inventory/items/${id}`),
  createItem: (data: any) => api.post('/api/inventory/items', data),
  stockIn: (data: { itemId: string, quantity: number, type: string, note?: string }) =>
    api.post('/api/inventory/stock-in', data),
  stockOut: (data: { itemId: string, quantity: number, type: string, note?: string }) =>
    api.post('/api/inventory/stock-out', data),
  adjustment: (data: { itemId: string, newQuantity: number, unit?: string, note?: string }) =>
    api.post('/api/inventory/adjustment', data),
  getMovements: (params?: any) => api.get('/api/inventory/movements', { params }),
  getAlerts: (params?: { franchiseId?: string; warehouseId?: string }) => api.get('/api/inventory/alerts', { params }),
  // Role-aware: SUPER_ADMIN gets every warehouse (each item tagged with
  // franchiseId/franchiseName if it's some franchise's primary warehouse,
  // both null otherwise); FRANCHISE_ADMIN gets only their own franchise's
  // primary warehouse (empty array if none is set). Enforced server-side.
  getWarehouses: (params?: { includeInactive?: boolean; all?: boolean; status?: string; scope?: string; forGRN?: boolean }) => 
    api.get('/api/warehouses', { params }),
  getNextWarehouseCode: () => api.get<{ code: string }>('/api/warehouses/next-code'),
  createWarehouse: (data: { name: string, location?: string, type?: string, code?: string, status?: string, franchiseId?: string }) => 
    api.post('/api/warehouses', data),
  updateWarehouse: (id: string, data: { name?: string, location?: string, type?: string, status?: string }) => 
    api.patch(`/api/warehouses/${id}`, data),
  deleteWarehouse: (id: string) =>
    api.delete(`/api/warehouses/${id}`),
  getWarehouseStock: (id: string) => api.get(`/api/warehouses/${id}/stock`),
  getReconciliationSheet: (franchiseId?: string) => api.get('/api/inventory/reconciliation', { params: { franchiseId } }),
  submitReconciliation: (entries: { itemId: string; physicalCount: number; note?: string }[]) =>
    api.post('/api/inventory/reconciliation', { entries }),
};

// --- Production Workflow ---
// Operator-chosen purchase lot (batchId null = stock with no lot on record), qty in stock unit.
export type LotAllocation = { batchId: string | null; qty: number };
// Additional production expense; row limits a per-kg / per-packet line to one pack-size row.
export type ExpenseLine = { category: string; basis: 'PER_BATCH' | 'PER_KG' | 'PER_PACKET'; rate: number; row?: number | null };

export const productionApi = {
  getHistory: (params?: any) => {
    const p = typeof params === 'string' ? { franchiseId: params } : params;
    return api.get('/api/production/history', { params: p });
  },
  startBatch: (data: any) => api.post('/api/production/batch', data),
  // Start from the recipe's saved formulation scaled to a target yield;
  // the backend re-validates stock and freezes a formulation snapshot.
  startPlanned: (data: { recipeId: string; formulationId: string; targetQty: number; targetUnit: string; warehouseId: string; franchiseId?: string; expiryDate?: string; productionType?: string; lotAllocations?: Record<string, LotAllocation[]> }) =>
    api.post('/api/production/plan/start', data),
  stopBatch: (id: string) => api.post(`/api/production/${id}/stop`),
  // { varianceRemarksThresholdPct } — remarks required above this yield variance.
  getCompletionSettings: () => api.get('/api/production/completion-settings'),
  // Production-eligible lots per material in a warehouse (oldest first) + untracked stock.
  getLotOptions: (warehouseId: string, itemIds: string[]) =>
    api.get('/api/production/lot-options', { params: { warehouseId, itemIds: itemIds.join(',') } }),
  // { categories: [{code,label}], bases: ['PER_BATCH','PER_KG','PER_PACKET'] }
  getCostingSettings: () => api.get('/api/production/costing-settings'),
  getBatchCostSummary: (id: string) => api.get(`/api/production/batches/${id}/cost-summary`),
  // Same calculation Confirm Packaging posts; writes nothing.
  previewPackagingCost: (id: string, data: { rows: Array<{ packetSize: string; packedQty: number; damagedQty: number; productId?: string; sellingPrice?: number }>; expenses: ExpenseLine[] }) =>
    api.post(`/api/production/batches/${id}/packaging-cost-preview`, data),
  approveBatch: (id: string, data?: { actualYield?: number; remarks?: string; expiryDate?: string; wastageQty?: number; wastageNote?: string; additionalMaterials?: Array<{ inventoryItemId: string; quantity: number; lots?: LotAllocation[]; note?: string }> }) => api.post(`/api/production/${id}/approve`, data),
  updateStatus: (id: string, status: string) => api.patch(`/api/production/${id}/status`, { status }),
  getPendingQC: (params?: any) => {
    const p = typeof params === 'string' ? { franchiseId: params } : params;
    return api.get('/api/production/batches-pending-qc', { params: p });
  },
  inspectBatch: (id: string, data: any) => api.post(`/api/production/batches/${id}/qc`, data),
  // Phase 1 of two-phase packaging: creates an AWAITING_CONFIRMATION ticket
  // only — bulk stock and Finished Goods are untouched until confirmPackaging.
  packageBatch: (id: string, data: any) => api.post(`/api/production/batches/${id}/package`, data),
  wasteBalance: (id: string, note?: string) => api.post(`/api/production/batches/${id}/waste-balance`, { note }),
  // Simplified workflow: reserve bulk, credit Finished Goods (per SKU) and
  // record damaged packets as wastage in ONE server transaction — for one or
  // several pack sizes of the batch (Packaging & Confirmation).
  // expectedPackagedQty is the batch's packagedQty as last seen on screen — a
  // repeated/stale submission is rejected instead of packing twice.
  packageAndConfirm: (id: string, data: {
    expectedPackagedQty: number;
    rows: Array<{
      packetSize: string;
      packedQty: number;
      damagedQty: number;
      productId?: string;
      newProduct?: { name: string; sku?: string; basePrice: number };
    }>;
    expenses?: ExpenseLine[];
  }) => api.post(`/api/production/batches/${id}/package-confirm`, data),
  // Releases a batch completed while production QC was still required (still
  // PENDING, never inspected) to packaging now that QC is switched off.
  releaseToPackaging: (id: string) => api.post(`/api/production/batches/${id}/release-to-packaging`),
  // Phase 2: reports the good/damaged/spoiled split for the completed
  // physical packaging run. Only now is bulk deducted and Finished Goods created.
  verifyPackaging: (packagingId: string, data: { stickersPrinted: number; physicalChecked: boolean; goodQty: number; damagedQty: number; spoiledQty: number }) =>
    api.put(`/api/production/packagings/${packagingId}/verify`, data),
  confirmPackaging: (packagingId: string, data: { goodQty: number; damagedQty: number; spoiledQty: number; productId?: string }) =>
    api.post(`/api/production/packagings/${packagingId}/confirm`, data),
  cancelPackaging: (packagingId: string, data?: { reason?: string }) =>
    api.post(`/api/production/packagings/${packagingId}/cancel`, data || {}),
  getPackagings: (franchiseId?: string) => api.get('/api/production/packagings', { params: { franchiseId } }),
  getAllBatches: (params?: any) => {
    const p = typeof params === 'string' ? { franchiseId: params } : params;
    return api.get('/api/production/batches-all', { params: p });
  },
  advanceStage: (id: string, stage: string) => api.patch(`/api/production/${id}/stage`, { stage }),
};

export const cartonApi = {
  getAll: (params?: any) => {
    const p = typeof params === 'string' ? { franchiseId: params } : params;
    return api.get('/api/production/cartons', { params: p });
  },
  create: (data: {
    batchId: string;
    cartonSize: string;
    unitsPerCarton: number;
    cartonCount: number;
    weightPerCarton?: number;
    franchiseId?: string;
  }) => api.post('/api/production/cartons', data),
};

export const productBatchesApi = {
  getAll: (params: { productId?: string; franchiseId?: string } = {}) =>
    api.get('/api/production/batches', { params }),
};

export const recallApi = {
  getEligibility: (batchId: string) => api.get(`/api/production/batches/${batchId}/recall/eligibility`),
  getState: (batchId: string) => api.get(`/api/production/batches/${batchId}/recall`),
  initiate: (batchId: string, data: { reason: string; reasonNotes?: string; severity?: string; description?: string }) =>
    api.post(`/api/production/batches/${batchId}/recall/initiate`, data),
  // Recall Details: batch, per-SKU quantities, locations, activity, audit trail
  // (also previews affected stock for a batch with no recall yet).
  getDetails: (batchId: string) => api.get(`/api/production/batches/${batchId}/recall/details`),
  list: () => api.get('/api/production/recalls'),
  quarantineSummary: () => api.get('/api/production/recalls/quarantine-summary'),
  recover: (batchId: string, data: { inventoryBatchId: string; returnedQty: number; note?: string }) =>
    api.post(`/api/production/batches/${batchId}/recall/collect-return`, data),
  dispose: (batchId: string, data: { inventoryBatchId: string; quantity: number; note: string }) =>
    api.post(`/api/production/batches/${batchId}/recall/dispose`, data),
  reconcile: (batchId: string, data: { lines: Array<{ inventoryItemId: string; unavailableQty: number }>; notes: string }) =>
    api.post(`/api/production/batches/${batchId}/recall/reconcile`, data),
  locateDistribution: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/locate-distribution`),
  blockSales: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/block-sales`),
  generateReport: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/generate-report`),
  collectReturn: (batchId: string, returnedQty: number) =>
    api.post(`/api/production/batches/${batchId}/recall/collect-return`, { returnedQty }),
  complete: (batchId: string, note?: string) => api.post(`/api/production/batches/${batchId}/recall/complete`, { note }),
  cancel: (batchId: string, note?: string) => api.post(`/api/production/batches/${batchId}/recall/cancel`, { note }),
};

export const wasteApi = {
  getAll: (params: { dateFrom?: string; dateTo?: string; franchiseId?: string; warehouseId?: string } = {}) =>
    api.get('/api/waste', { params }),
  getSummary: (params: { franchiseId?: string; warehouseId?: string } = {}) =>
    api.get('/api/waste/summary', { params }),
  create: (data: { itemId: string; quantity: number; reason: string; note?: string; franchiseId?: string; warehouseId?: string }) =>
    api.post('/api/waste', data),
  update: (id: string, data: { reason?: string; note?: string }) =>
    api.patch(`/api/waste/${id}`, data),
};
