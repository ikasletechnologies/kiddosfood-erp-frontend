import api from './base';

// --- Billing & POS ---
export const posApi = {
  checkout: (data: any) => api.post('/api/orders/checkout', data),
  getOrders: (params: any = {}) => api.get('/api/orders', { params }),
  getOrderById: (id: string) => api.get(`/api/orders/${id}`),
  getInvoice: (orderId: string) => api.get(`/api/invoices/${orderId}`),
  updateStatus: (id: string, status: string) => api.patch(`/api/orders/${id}/status`, { status }),
  addPayment: (id: string, data: any) => api.post(`/api/orders/${id}/payment`, data),
};

// --- POS Day Closing / Settlement ---
export const posSettlementApi = {
  getToday: (params: any = {}) => api.get('/api/pos/settlement/today', { params }),
  getLatest: (params: any = {}) => api.get('/api/pos/settlement/latest', { params }),
  // Live, server-computed totals (Order + Payment tables) for the open
  // business day — the same numbers closeDay validates against.
  getSummary: (params: any = {}) => api.get('/api/pos/settlement/summary', { params }),
  closeDay: (data: any = {}) => api.post('/api/pos/settlement/close', data),
};

// --- Sales Module (Quotations, Orders, Returns) ---
export const salesApi = {
  getQuotations: (params?: any) => api.get('/api/sales/quotations', { params }),
  createQuotation: (data: any) => api.post('/api/sales/quotations', data),
  getQuotationById: (id: string) => api.get(`/api/sales/quotations/${id}`),
  updateQuotation: (id: string, data: any) => api.patch(`/api/sales/quotations/${id}`, data),
  convertQuotation: (id: string) => api.post(`/api/sales/quotations/${id}/convert`),

  getSalesOrders: (params?: any) => api.get('/api/sales/orders', { params }),
  getSalesOrderById: (id: string) => api.get(`/api/sales/orders/${id}`),
  createSalesOrder: (data: any) => api.post('/api/sales/orders', data),
  updateSalesOrder: (id: string, data: any) => api.patch(`/api/sales/orders/${id}`, data),

  getDeliveryChallans: (params?: any) => api.get('/api/sales/delivery-challans', { params }),
  getDeliveryChallanById: (id: string) => api.get(`/api/sales/delivery-challans/${id}`),
  createDeliveryChallan: (data: any) => api.post('/api/sales/delivery-challans', data),
  updateDeliveryChallan: (id: string, data: any) => api.patch(`/api/sales/delivery-challans/${id}`, data),
  markDeliveryChallanDelivered: (id: string, data: { receivedBy?: string; deliveredAt?: string; podReference?: string }) =>
    api.post(`/api/sales/delivery-challans/${id}/deliver`, data),

  getTransitStock: () => api.get('/api/sales/transit-stock'),
  getDispatchTracking: (params?: { status?: string }) => api.get('/api/sales/dispatch-tracking', { params }),

  getDeliveryChallanReturns: (params?: { challanId?: string }) => api.get('/api/sales/delivery-challan-returns', { params }),
  createDeliveryChallanReturn: (data: any) => api.post('/api/sales/delivery-challan-returns', data),
  receiveDeliveryChallanReturn: (id: string, itemConditions: Array<{ returnItemId: string; condition: string }>) =>
    api.post(`/api/sales/delivery-challan-returns/${id}/receive`, { itemConditions }),


  getReturns: (params?: any) => api.get('/api/sales/returns', { params }),
  createReturn: (data: any) => api.post('/api/sales/returns', data),
  updateReturnStatus: (id: string, status: string, approvedBy?: string) => 
    api.patch(`/api/sales/returns/${id}`, { status, approvedBy }),
  
  getAnalytics: (params?: any) => api.get('/api/sales/analytics', { params }),
};

// --- Drafts Management ---
export const draftsApi = {
  getDrafts: (type: string) => api.get('/api/drafts', { params: { type } }),
  saveDraft: (data: any) => api.post('/api/drafts', data),
  deleteDraft: (id: string) => api.delete(`/api/drafts/${id}`),
};

// --- Customer Management ---
export const customersApi = {
  getAll: (params: any = {}) => api.get('/api/customers', { params }),
  getById: (id: string) => api.get(`/api/customers/${id}`),
  search: (query: string) => api.get(`/api/customers`, { params: { search: query } }),
  create: (data: any) => api.post('/api/customers', data),
  update: (id: string, data: any) => api.patch(`/api/customers/${id}`, data),
  delete: (id: string) => api.delete(`/api/customers/${id}`),
  getLedgerSummary: (params: any = {}) => api.get('/api/customers/ledger-summary', { params }),
};

// External B2B reseller master — distinct from Customer, franchise-scoped
// server-side (SUPER_ADMIN may pass franchiseId to target a specific
// franchise's dealers; FRANCHISE_ADMIN is always forced to their own).
export const dealersApi = {
  getAll: (params: { franchiseId?: string } = {}) => api.get('/api/dealers', { params }),
  create: (data: any) => api.post('/api/dealers', data),
  delete: (id: string) => api.delete(`/api/dealers/${id}`),
};

// --- Logistics & Transfers (Internal) ---
export const logisticsApi = {
  getRequests: (params: any = {}) => api.get('/api/logistics/requests', { params }),
  createRequest: (data: any) => api.post('/api/logistics/requests', data),
  approveRequest: (id: string, approvedItems: any[]) => 
    api.patch(`/api/logistics/requests/${id}/approve`, { approvedItems }),
  
  getTransfers: (params: any = {}) => api.get('/api/logistics/transfers', { params }),
  initiateTransfer: (data: any) => api.post('/api/logistics/transfers', data),
  dispatchTransfer: (id: string) => api.patch(`/api/logistics/transfers/${id}/dispatch`),
  completeTransfer: (id: string) => api.patch(`/api/logistics/transfers/${id}/complete`),
  getInTransit: (params: any = {}) => api.get('/api/logistics/transfers/in-transit', { params }),
};
