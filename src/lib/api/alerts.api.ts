import api from './base';

export interface AlertFilters {
  type?: string;
  severity?: string;
  isRead?: boolean;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  franchiseId?: string;
}

export const alertsApi = {
  getAlerts: (params?: AlertFilters) => api.get('/alerts', { params }),
  getSummary: (params?: { franchiseId?: string }) => api.get('/alerts/summary', { params }),
  markAsRead: (id: string) => api.patch(`/alerts/${id}/read`),
  markAllAsRead: (params?: { franchiseId?: string }) => api.post('/alerts/mark-all-read', params),
  reconcile: (params?: { franchiseId?: string }) => api.post('/alerts/reconcile', null, { params }),
};
