import api from './base';

// --- User Management & Governance ---
export const usersApi = {
  getAll: (skip = 0, take = 20) => api.get(`/api/users?skip=${skip}&take=${take}`),
  getById: (id: string) => api.get(`/api/users/${id}`),
  create: (data: any) => api.post('/api/users', data),
  update: (id: string, data: any) => api.patch(`/api/users/${id}`, data),
  delete: (id: string) => api.delete(`/api/users/${id}`),
};

export const userGovernanceApi = {
  getAll: (skip = 0, take = 20) => api.get(`/api/users?skip=${skip}&take=${take}`),
  create: (data: any) => api.post('/api/users', data),
  update: (id: string, data: any) => api.patch(`/api/users/${id}`, data),
  resetPassword: (id: string, data: { password: string }) => 
    api.patch(`/api/users/${id}/reset-password`, data),
  delete: (id: string) => api.delete(`/api/users/${id}`),
};

// --- System Audit & Logging ---
export const auditApi = {
  getLogs: (params?: any) => api.get('/api/audit/logs', { params }),
};

// --- Roles & Permissions (RBAC) ---
export const rolesApi = {
  getAll: () => api.get('/api/roles'),
  getOne: (id: string) => api.get(`/api/roles/${id}`),
  create: (data: any) => api.post('/api/roles', data),
  update: (id: string, data: any) => api.patch(`/api/roles/${id}`, data),
  delete: (id: string) => api.delete(`/api/roles/${id}`),
};

export const permissionsApi = {
  getAll: () => api.get('/api/permissions'),
};

// --- Approval Workflows ---
export const workflowApprovalsApi = {
  getAll: (category?: string) => api.get('/api/workflow-approvals', { params: category ? { category } : undefined }),
  getOne: (id: string) => api.get(`/api/workflow-approvals/${id}`),
  create: (data: any) => api.post('/api/workflow-approvals', data),
  approve: (id: string, notes?: string) => api.post(`/api/workflow-approvals/${id}/approve`, { notes }),
};

// --- System Settings & Company Profile ---
export const settingsApi = {
  getCompanyProfile: () => api.get('/api/settings/company'),
  updateCompanyProfile: (data: any) => api.patch('/api/settings/company', data),
};
