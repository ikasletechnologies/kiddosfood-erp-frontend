import api from './base';

// --- Vendors ---
export const vendorsApi = {
  getAll: () => api.get('/api/vendors'),
  getSummary: () => api.get('/api/vendors/summary'),
  filterVendors: (params: any) => api.get('/api/vendors/filter', { params }),
  getById: (id: string) => api.get(`/api/vendors/${id}`),
  create: (data: any) => api.post('/api/vendors', data),
  update: (id: string, data: any) => api.patch(`/api/vendors/${id}`, data),
  delete: (id: string) => api.delete(`/api/vendors/${id}`),
  linkMaterial: (data: { vendorId: string; materialId: string; price: number; quantity: number }) =>
    api.post('/api/vendors/link-material', data),
  getLedger: (id: string, params: any = {}) => api.get(`/api/vendors/${id}/ledger`, { params }),
  getReturnableMaterials: (id: string) => api.get(`/api/vendors/${id}/returnable-materials`),
  getAging: (id: string) => api.get(`/api/vendors/${id}/aging`),
  getNextPaymentNumber: (date?: string) => api.get('/api/vendors/next-payment-number', { params: { date } }),
  recordPayment: (id: string, data: { amount: number; note: string; accountId: string; type?: string; paymentMode?: string; referenceId?: string; vendorInvoiceId?: string; transactionRef?: string; idempotencyKey?: string; allowOverpayment?: boolean; date?: string }) => api.post(`/api/vendors/${id}/payment`, data),
  recordAdjustment: (id: string, data: { amount: number; type: 'CREDIT' | 'DEBIT'; note: string; referenceType?: string, referenceId?: string }) => api.post(`/api/vendors/${id}/adjustment`, data),
};

// --- Vendor Ledger ---
export const vendorLedgerApi = {
  getBalance: (vendorId: string) => api.get(`/api/vendors/${vendorId}/balance`),
  getLedger: (vendorId: string, params?: any) => api.get(`/api/vendors/${vendorId}/ledger`, { params }),
};

// --- Procurement (Purchase Orders) ---
export const purchaseOrdersApi = {
  getAll: () => api.get('/api/purchase-orders'),
  getNextNumber: () => api.get('/api/purchase-orders/next-number'),
  getById: (id: string) => api.get(`/api/purchase-orders/${id}`),
  create: (data: {
    vendorId: string;
    poNumber?: string;
    advancePaid?: number;
    expectedDeliveryDate?: string;
    notes?: string;
    internalNotes?: string;
    vendorNotes?: string;
    deliveryInstructions?: string;
    status?: string;
    freightCost?: number;
    unloadingCost?: number;
    items: { inventoryItemId: string; quantity: number; price: number; hsnCode?: string; gstRate?: number }[];
    manualTax?: { cgst: number, sgst: number, igst: number };
  }) => api.post('/api/purchase-orders', data),
  update: (id: string, data: any) => api.patch(`/api/purchase-orders/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/api/purchase-orders/${id}/status`, { status }),
  receive: (id: string) => api.post(`/api/purchase-orders/${id}/receive`),
  recordAdvance: (id: string, advancePaid: number) =>
    api.patch(`/api/purchase-orders/${id}/advance`, { advancePaid }),
  applyAdvance: (id: string) =>
    api.post(`/api/purchase-orders/${id}/apply-advance`),
  cancel: (id: string) => api.patch(`/api/purchase-orders/${id}/cancel`),
  delete: (id: string) => api.delete(`/api/purchase-orders/${id}`),
};

export const procurementApi = {
  getPOs: (params?: any) => api.get('/api/purchase-orders', { params }),
  getNextNumber: () => api.get('/api/purchase-orders/next-number'),
  getById: (id: string) => api.get(`/api/purchase-orders/${id}`),
  createPO: (data: any) => api.post('/api/purchase-orders', data),
  approve: (id: string) => api.patch(`/api/purchase-orders/${id}/approve`),
  cancel: (id: string) => api.patch(`/api/purchase-orders/${id}/cancel`),
};

// --- Purchase Returns ---
export const purchaseReturnsApi = {
  getAll: (params: any = {}) => api.get('/api/purchase/returns', { params }),
  create: (data: { vendorId: string; reason: string; items: any[]; returnSource?: string }) =>
    api.post('/api/purchase/returns', data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/purchase/returns/${id}`, { status }),
};

// --- Goods Receipt Notes (GRN) ---
export const grnApi = {
  getAll: (params: any = {}) => api.get('/api/grn', { params }),
  getById: (id: string) => api.get(`/api/grn/${id}`),
  generateLotNumber: () => api.get('/api/grn/generate-lot-number'),
  createFromPO: (poId: string, data: { items: any[], receivedBy?: string }) => 
    api.post(`/api/grn/from-po/${poId}`, data),
  approve: (id: string) => api.patch(`/api/grn/${id}/approve`),
  cancel: (id: string) => api.patch(`/api/grn/${id}/cancel`),
};

// --- Quality Control ---
export const qcApi = {
  getPending: () => api.get('/api/qc/pending'),
  inspect: (data: {
    grnItemId: string;
    approvedQty: number;
    rejectedQty: number;
    actionTaken: 'APPROVE' | 'REJECT_RETURN' | 'REJECT_SCRAP' | 'REWORK' | 'HOLD';
    remarks?: string;
    temperature?: number;
    moistureContent?: number;
    packagingOk?: boolean;
  }) => api.post('/api/qc/inspect', data),
};

// --- Vendor Invoices & Matching ---
export const vendorInvoicesApi = {
  getAll: (params: any = {}) => api.get('/api/vendor-invoices', { params }),
  create: (data: any) => api.post('/api/vendor-invoices', data),
  match: (id: string) => api.post(`/api/vendor-invoices/${id}/match`),
  approve: (id: string) => api.post(`/api/vendor-invoices/${id}/approve`),
  updateStatus: (id: string, status: string) => api.patch(`/api/vendor-invoices/${id}/status`, { status }),
};
