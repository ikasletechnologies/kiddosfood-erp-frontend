import api from './base';

// --- First-run System Setup (HQ + Warehouse) ---
export const setupApi = {
  getStatus: () => api.get('/api/setup/status'),
};
