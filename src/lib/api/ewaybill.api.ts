import api from './base';

// --- E-Way Bills (GST Rule 138) ---
export const ewayBillApi = {
  getMasters: () => api.get('/api/eway-bills/masters'),
  getStats: (params?: any) => api.get('/api/eway-bills/stats', { params }),
  getAll: (params?: any) => api.get('/api/eway-bills', { params }),
  getById: (id: string) => api.get(`/api/eway-bills/${id}`),
  getSources: (sourceType: string, search?: string) => api.get('/api/eway-bills/sources', { params: { sourceType, search } }),
  prefill: (sourceType: string, sourceId: string) => api.get('/api/eway-bills/prefill', { params: { sourceType, sourceId } }),
  create: (data: any) => api.post('/api/eway-bills', data),
  update: (id: string, data: any) => api.patch(`/api/eway-bills/${id}`, data),
  remove: (id: string) => api.delete(`/api/eway-bills/${id}`),
  markGenerated: (id: string, data: { ewbNumber: string; ewbDate?: string; validUntil?: string }) => api.post(`/api/eway-bills/${id}/generate`, data),
  updateVehicle: (id: string, data: any) => api.post(`/api/eway-bills/${id}/vehicle`, data),
  extendValidity: (id: string, data: any) => api.post(`/api/eway-bills/${id}/extend`, data),
  cancel: (id: string, data: { reasonCode: string; remarks?: string }) => api.post(`/api/eway-bills/${id}/cancel`, data),
  exportJson: (ids: string[]) => api.post('/api/eway-bills/export-json', { ids }),
};
