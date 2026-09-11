import api from './base';

// --- Franchise Management & Governance ---
export const franchiseApi = {
  getAll: (params?: any) => api.get('/api/franchise', { params }),
  getById: (id: string) => api.get(`/api/franchise/${id}`),
  create: (data: any) => api.post('/api/franchise', data),
  update: (id: string, data: any) => api.patch(`/api/franchise/${id}`, data),
  delete: (id: string) => api.delete(`/api/franchise/${id}`),
  verifyPassword: (id: string, password: string) => api.post(`/api/franchise/${id}/verify-password`, { password }),
  
  // User Management within Franchise
  getUsers: (id: string) => api.get(`/api/franchise/${id}/users`),
  
  // Logistics Compatibility (Franchise requests to HQ)
  getRequests: (params?: any) => api.get('/api/logistics/requests', { params }),
  createRequest: (data: any) => api.post('/api/logistics/requests', data),
  approveRequest: (id: string, approvedItems: any[]) =>
    api.patch(`/api/logistics/requests/${id}/approve`, { approvedItems }),
  getTransfers: (params?: any) => api.get('/api/logistics/transfers', { params }),
  getInTransitTransfers: (params?: any) => api.get('/api/logistics/transfers/in-transit', { params }),
  initiateTransfer: (data: {
    fromBranchId: string;
    toBranchId: string;
    items: { inventoryItemId: string; quantity: number }[];
  }) => api.post('/api/logistics/transfers', data),
  dispatchTransfer: (id: string) => api.patch(`/api/logistics/transfers/${id}/dispatch`),
  completeTransfer: (id: string) => api.patch(`/api/logistics/transfers/${id}/complete`),
};

// --- Dedicated Franchise Warehouse Setup & Status Flow ---
export interface FranchiseWarehouseStatus {
  configured: boolean;
  franchise: {
    id: string;
    name: string;
    location?: string;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    location?: string;
    type: string;
    status: string;
    createdAt: string;
  } | null;
  nextCode?: string;
}

export const franchiseWarehouseApi = {
  getStatus: () => api.get<FranchiseWarehouseStatus>('/api/franchise/warehouse/status'),
  setup: (data: { name: string; location?: string; code?: string }) =>
    api.post('/api/franchise/warehouse/setup', data),
};

// --- Franchise Supply Orders (FO-YYYY-XXXX: HQ → Franchise execution) ---
export const franchiseOrdersApi = {
  getAll: (params?: { franchiseId?: string; status?: string; sourceRequestId?: string }) =>
    api.get('/api/franchise-orders', { params }),
  getById: (id: string) => api.get(`/api/franchise-orders/${id}`),
  create: (data: {
    franchiseId: string;
    sourceRequestId?: string;
    orderType?: 'STOCK' | 'REQUEST';
    paymentType?: 'COD' | 'ONLINE' | 'CREDIT';
    expectedDispatchDate?: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
  }) => api.post('/api/franchise-orders', data),
  updateStatus: (id: string, status: string, extra?: { actualDispatchDate?: string; notes?: string }) =>
    api.patch(`/api/franchise-orders/${id}/status`, { status, ...extra }),
  startProcessing: (id: string) =>
    api.patch(`/api/franchise/supply-orders/${id}/start-processing`, {}).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise-orders/${id}/status`, { status: 'PROCESSING' });
      }
      throw err;
    }),
  dispatch: (id: string, data: {
    dispatchDate: string;
    dispatchReference: string;
    transporter: string;
    vehicleNumber?: string;
    trackingNumber?: string;
    dispatchNote?: string;
    items?: Array<{ productId: string; dispatchedQuantity: number }>;
  }) =>
    api.patch(`/api/franchise/supply-orders/${id}/dispatch`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise-orders/${id}/status`, { status: 'DISPATCHED', ...data });
      }
      throw err;
    }),
  confirmReceipt: (id: string, data: {
    receiptNote?: string;
    items: Array<{
      productId: string;
      receivedQuantity: number;
      damagedQuantity?: number;
      missingQuantity?: number;
    }>;
  }) =>
    api.patch(`/api/franchise/supply-orders/${id}/confirm-receipt`, data).catch((err) => {
      if (err?.response?.status === 404) {
        const hasIssue = data.items.some(i => (i.damagedQuantity || 0) > 0 || (i.missingQuantity || 0) > 0);
        return api.patch(`/api/franchise-orders/${id}/status`, {
          status: hasIssue ? 'DELIVERY_ISSUE' : 'DELIVERED',
          ...data,
        });
      }
      throw err;
    }),
  resolveDeliveryIssue: (id: string, data: { resolutionNote: string }) =>
    api.patch(`/api/franchise/supply-orders/${id}/resolve-issue`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise-orders/${id}/status`, { status: 'DELIVERED', ...data });
      }
      throw err;
    }),

  // Direct cancellation for PENDING orders
  cancelPendingOrder: (id: string, data: { reasonCode: string; reasonNote?: string }) =>
    api.patch(`/api/franchise/supply-orders/${id}/cancel`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise-orders/${id}/status`, {
          status: 'CANCELLED',
          notes: data.reasonNote ? `${data.reasonCode}: ${data.reasonNote}` : data.reasonCode,
        });
      }
      throw err;
    }),

  // Cancellation Request for APPROVED / PROCESSING orders (separate entity)
  createCancellationRequest: (id: string, data: { reasonCode: string; reasonNote?: string }) =>
    api.post(`/api/franchise/supply-orders/${id}/cancellation-request`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.post(`/api/franchise-orders/${id}/cancellation-request`, data);
      }
      throw err;
    }),

  // Super Admin: Approve Cancellation Request (transitions order to CANCELLED and releases stock)
  approveCancellationRequest: (id: string, data?: { reviewNote?: string }) =>
    api.patch(`/api/franchise/supply-orders/${id}/cancellation-request/approve`, data || {}).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise-orders/${id}/status`, { status: 'CANCELLED', notes: data?.reviewNote });
      }
      throw err;
    }),

  // Super Admin: Reject Cancellation Request (order continues current workflow)
  rejectCancellationRequest: (id: string, data: { reviewNote?: string }) =>
    api.patch(`/api/franchise/supply-orders/${id}/cancellation-request/reject`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise-orders/${id}/cancellation-request/reject`, data);
      }
      throw err;
    }),

  // Franchise: Withdraw Cancellation Request
  withdrawCancellationRequest: (id: string) =>
    api.patch(`/api/franchise/supply-orders/${id}/cancellation-request/withdraw`, {}).catch((err) => {
      if (err?.response?.status === 404) {
        return api.delete(`/api/franchise-orders/${id}/cancellation-request`);
      }
      throw err;
    }),

  recordPayment: (id: string, amount: number) =>
    api.post(`/api/franchise-orders/${id}/payment`, { amount }),
  getInvoice: (id: string, interState = false) =>
    api.get(`/api/franchise-orders/${id}/invoice`, { params: { interState } }),
};

// Supply orders alias for seamless naming consistency
export const supplyOrdersApi = franchiseOrdersApi;

// --- Franchise Product Requests (FPR-YYYY-XXXX: Franchise Demand Intake) ---
export const franchiseProductRequestsApi = {
  getAll: (params?: { franchiseId?: string; status?: string; search?: string; fromDate?: string; toDate?: string }) =>
    api.get('/api/franchise/product-requests', { params }),
  
  getById: (id: string) =>
    api.get(`/api/franchise/product-requests/${id}`),

  create: (data: {
    franchiseId?: string;
    requestNotes?: string;
    requiredByDate?: string;
    products: {
      productId: string;
      productName?: string;
      unit?: string;
      requestedQuantity: number;
    }[];
  }) => api.post('/api/franchise/product-requests', data),

  // Super Admin Approval: approves request items and triggers FO supply order creation
  approve: (id: string, data: {
    adminResponse?: string;
    items?: Array<{
      productId: string;
      approvedQuantity: number;
      itemStatus: string;
      adminNote?: string;
    }>;
  }) => api.patch(`/api/franchise/product-requests/${id}/approve`, data).catch((err) => {
    if (err?.response?.status === 404) {
      return api.patch(`/api/franchise/product-requests/${id}`, { status: 'APPROVED', ...data });
    }
    throw err;
  }),

  reject: (id: string, data: { rejectionReason: string }) =>
    api.patch(`/api/franchise/product-requests/${id}/reject`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise/product-requests/${id}`, { status: 'REJECTED', adminResponse: data.rejectionReason, ...data });
      }
      throw err;
    }),

  cancel: (id: string, data?: { cancellationReason?: string }) =>
    api.patch(`/api/franchise/product-requests/${id}/cancel`, data || {}).catch((err) => {
      if (err?.response?.status === 404) {
        return api.delete(`/api/franchise/product-requests/${id}`);
      }
      throw err;
    }),

  startProcessing: (id: string) =>
    api.patch(`/api/franchise/product-requests/${id}/start-processing`, {}).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise/product-requests/${id}`, { status: 'PROCESSING' });
      }
      throw err;
    }),

  dispatch: (id: string, data: {
    dispatchDate: string;
    dispatchReference: string;
    transporter: string;
    vehicleNumber?: string;
    trackingNumber?: string;
    dispatchNote?: string;
    items?: Array<{ productId: string; dispatchedQuantity: number }>;
  }) => api.patch(`/api/franchise/product-requests/${id}/dispatch`, data).catch((err) => {
    if (err?.response?.status === 404) {
      return api.patch(`/api/franchise/product-requests/${id}`, { status: 'DISPATCHED', ...data });
    }
    throw err;
  }),

  confirmReceipt: (id: string, data: {
    receiptNote?: string;
    items: Array<{
      productId: string;
      receivedQuantity: number;
      damagedQuantity?: number;
      missingQuantity?: number;
    }>;
  }) => api.patch(`/api/franchise/product-requests/${id}/confirm-receipt`, data).catch((err) => {
    if (err?.response?.status === 404) {
      const hasIssue = data.items.some(i => (i.damagedQuantity || 0) > 0 || (i.missingQuantity || 0) > 0);
      return api.patch(`/api/franchise/product-requests/${id}`, {
        status: hasIssue ? 'DELIVERY_ISSUE' : 'DELIVERED',
        ...data,
      });
    }
    throw err;
  }),

  resolveDeliveryIssue: (id: string, data: { resolutionNote: string }) =>
    api.patch(`/api/franchise/product-requests/${id}/resolve-delivery-issue`, data).catch((err) => {
      if (err?.response?.status === 404) {
        return api.patch(`/api/franchise/product-requests/${id}`, { status: 'DELIVERED', ...data });
      }
      throw err;
    }),

  update: (id: string, data: { status: string; [key: string]: any }) =>
    api.patch(`/api/franchise/product-requests/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/franchise/product-requests/${id}`),
};

// --- Unified Inventory Demand Service ---
export interface InventoryDemandItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  // The underlying InventoryItem.id at HQ for this SKU, if one exists —
  // needed to route to the Item Master edit screen, which edits a single
  // InventoryItem row, not the Product catalog entry.
  hqInventoryItemId?: string;
  hqAvailableStock: number;
  // Reorder threshold from the HQ InventoryItem row (InventoryItem.minimumStock).
  // Undefined when there's no matched HQ item yet — Low Stock filtering treats
  // that as "unknown," not "low," so an uncatalogued row never falsely alarms.
  hqMinimumStock?: number;
  hqReservedStock: number;
  inTransitStock: number;
  totalFranchiseAvailableStock: number;
  totalFranchiseDamagedStock: number;
  pendingDemandQuantity: number;
  pendingRequestCount: number;
  approvedDemandQuantity: number;
  approvedOrderCount: number;
  branchStockBreakdown: Array<{
    franchiseId: string;
    franchiseName: string;
    availableQuantity: number;
    damagedQuantity: number;
  }>;
  demandRecords: Array<{
    recordType: 'PRODUCT_REQUEST' | 'SUPPLY_ORDER';
    id: string;
    referenceNumber: string;
    franchiseId: string;
    franchiseName: string;
    quantity: number;
    approvedQuantity?: number;
    requiredBy?: string;
    status: string;
    createdAt: string;
  }>;
}

export const inventoryDemandApi = {
  getSummary: () =>
    api.get('/api/franchise/inventory-demand/summary'),
  getByProductId: (productId: string) =>
    api.get(`/api/franchise/inventory-demand/${productId}`),
};
