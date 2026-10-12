import api from './base';

export interface AssistantReply {
  conversationId: string;
  answer: string;
  links: string[];
  usedLiveData: boolean;
  retrievedAt: string | null;
  readOnly: true;
}

export interface AssistantStatus {
  available: boolean;
  model: string;
  readOnly: true;
  liveDataSentToModel: false;
  featureFlags: Record<string, boolean>;
}

export const assistantApi = {
  status: () => api.get<AssistantStatus>('/api/assistant/status'),
  chat: (data: { message: string; conversationId: string; pagePath: string }) =>
    api.post<AssistantReply>('/api/assistant/chat', data),
  clear: (conversationId: string) =>
    api.post('/api/assistant/clear', { conversationId }),
};
