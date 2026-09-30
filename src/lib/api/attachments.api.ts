import api from './base';

// --- File attachments (Sales Order Image / Document, …) ---
export type AttachmentKind = 'IMAGE' | 'DOCUMENT';

export interface AttachmentMeta {
  id: string;
  entityType: string;
  entityId: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export const attachmentsApi = {
  list: (entityType: string, entityId: string) =>
    api.get<AttachmentMeta[]>('/api/attachments', { params: { entityType, entityId } }),
  upload: (data: { entityType: string; entityId: string; kind: AttachmentKind; fileName: string; mimeType: string; dataBase64: string }) =>
    api.post<AttachmentMeta>('/api/attachments', data),
  // Fetched as a blob through the authenticated client (a plain <a href>
  // wouldn't carry the Bearer token).
  getFile: (id: string) => api.get(`/api/attachments/${id}/file`, { responseType: 'blob' }),
  remove: (id: string) => api.delete(`/api/attachments/${id}`),
};
