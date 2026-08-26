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
};

// --- Raw Materials ---
export const rawMaterialsApi = {
  getAll: (includeInactive = false, franchiseId?: string, excludeCategory?: string) =>
    api.get('/api/raw-materials', { params: { includeInactive, franchiseId, excludeCategory } }),
  getById: (id: string) => api.get(`/api/raw-materials/${id}`),
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
  getRawMaterialConsumption: (warehouseId?: string, franchiseId?: string, category?: string) => api.get('/api/inventory/raw-materials/consumption', { params: { warehouseId, franchiseId, category } }),
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
  adjustment: (data: { itemId: string, newQuantity: number, note?: string }) =>
    api.post('/api/inventory/adjustment', data),
  getMovements: (params?: any) => api.get('/api/inventory/movements', { params }),
  getAlerts: () => api.get('/api/inventory/alerts'),
  // Role-aware: SUPER_ADMIN gets every warehouse (each item tagged with
  // franchiseId/franchiseName if it's some franchise's primary warehouse,
  // both null otherwise); FRANCHISE_ADMIN gets only their own franchise's
  // primary warehouse (empty array if none is set). Enforced server-side.
  getWarehouses: () => api.get('/api/warehouses'),
  createWarehouse: (data: { name: string, location?: string, type?: string, code?: string, status?: string, franchiseId?: string }) => 
    api.post('/api/warehouses', data),
  updateWarehouse: (id: string, data: { name?: string, location?: string, type?: string }) => 
    api.patch(`/api/warehouses/${id}`, data),
  deleteWarehouse: (id: string) =>
    api.delete(`/api/warehouses/${id}`),
  getWarehouseStock: (id: string) => api.get(`/api/warehouses/${id}/stock`),
  getReconciliationSheet: (franchiseId?: string) => api.get('/api/inventory/reconciliation', { params: { franchiseId } }),
  submitReconciliation: (entries: { itemId: string; physicalCount: number; note?: string }[]) =>
    api.post('/api/inventory/reconciliation', { entries }),
};

// --- Production Workflow ---
export const productionApi = {
  getHistory: (franchiseId?: string) => api.get('/api/production/history', { params: { franchiseId } }),
  startBatch: (data: any) => api.post('/api/production/batch', data),
  stopBatch: (id: string) => api.post(`/api/production/${id}/stop`),
  approveBatch: (id: string, data?: { actualYield?: number; remarks?: string; expiryDate?: string }) => api.post(`/api/production/${id}/approve`, data),
  updateStatus: (id: string, status: string) => api.patch(`/api/production/${id}/status`, { status }),
  getPendingQC: (franchiseId?: string) => api.get('/api/production/batches-pending-qc', { params: { franchiseId } }),
  inspectBatch: (id: string, data: any) => api.post(`/api/production/batches/${id}/qc`, data),
  // Phase 1 of two-phase packaging: creates an AWAITING_CONFIRMATION ticket
  // only — bulk stock and Finished Goods are untouched until confirmPackaging.
  packageBatch: (id: string, data: any) => api.post(`/api/production/batches/${id}/package`, data),
  // Phase 2: reports the good/damaged/spoiled split for the completed
  // physical packaging run. Only now is bulk deducted and Finished Goods created.
  verifyPackaging: (packagingId: string, data: { stickersPrinted: number; physicalChecked: boolean; goodQty: number; damagedQty: number; spoiledQty: number }) =>
    api.put(`/api/production/packagings/${packagingId}/verify`, data),
  confirmPackaging: (packagingId: string, data: { goodQty: number; damagedQty: number; spoiledQty: number }) =>
    api.post(`/api/production/packagings/${packagingId}/confirm`, data),
  getPackagings: (franchiseId?: string) => api.get('/api/production/packagings', { params: { franchiseId } }),
  getAllBatches: (franchiseId?: string) => api.get('/api/production/batches-all', { params: { franchiseId } }),
  advanceStage: (id: string, stage: string) => api.patch(`/api/production/${id}/stage`, { stage }),
};

export const cartonApi = {
  getAll: (franchiseId?: string) => api.get('/api/production/cartons', { params: { franchiseId } }),
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
  initiate: (batchId: string, data: { reason: string; reasonNotes?: string }) =>
    api.post(`/api/production/batches/${batchId}/recall/initiate`, data),
  locateDistribution: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/locate-distribution`),
  blockSales: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/block-sales`),
  generateReport: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/generate-report`),
  collectReturn: (batchId: string, returnedQty: number) =>
    api.post(`/api/production/batches/${batchId}/recall/collect-return`, { returnedQty }),
  complete: (batchId: string) => api.post(`/api/production/batches/${batchId}/recall/complete`),
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
