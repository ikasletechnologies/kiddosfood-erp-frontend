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

// --- Franchise Orders (HQ → Franchise fulfillment) ---
export const franchiseOrdersApi = {
  getAll: (params?: { franchiseId?: string; status?: string }) =>
    api.get('/api/franchise-orders', { params }),
  getById: (id: string) => api.get(`/api/franchise-orders/${id}`),
  create: (data: {
    franchiseId: string;
    orderType?: 'STOCK' | 'REQUEST';
    paymentType?: 'COD' | 'ONLINE';
    expectedDispatchDate?: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
  }) => api.post('/api/franchise-orders', data),
  updateStatus: (id: string, status: string, extra?: { actualDispatchDate?: string }) =>
    api.patch(`/api/franchise-orders/${id}/status`, { status, ...extra }),
  recordPayment: (id: string, amount: number) =>
    api.post(`/api/franchise-orders/${id}/payment`, { amount }),
  getInvoice: (id: string, interState = false) =>
    api.get(`/api/franchise-orders/${id}/invoice`, { params: { interState } }),
};

// --- Franchise Product Requests (Ad-hoc) ---
export const franchiseProductRequestsApi = {
  getAll: () => api.get('/api/franchise/product-requests'),
  create: (data: { franchiseId: string; products: { productId?: string; productName: string; quantity: number; unit: string }[] }) =>
    api.post('/api/franchise/product-requests', data),
  update: (id: string, data: { status: string; adminResponse?: string }) =>
    api.patch(`/api/franchise/product-requests/${id}`, data),
  delete: (id: string) => api.delete(`/api/franchise/product-requests/${id}`),
};
