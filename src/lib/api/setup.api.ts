import api from './base';

// --- First-run System Setup (HQ + Warehouse) ---
export const setupApi = {
  getStatus: () => api.get('/api/setup/status'),
  // HQ is resolved server-side — deliberately no franchiseId in this
  // payload. The browser must never choose which franchise is HQ.
  createWarehouse: (data: { name: string; code?: string; location?: string }) =>
    api.post('/api/setup/warehouse', data),
};
