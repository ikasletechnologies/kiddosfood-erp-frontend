import api from './base';

export type ChatRole = 'SUPER_ADMIN' | 'FRANCHISE_ADMIN';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderRole: ChatRole;
  senderName: string;
  messageType: 'TEXT';
  content: string;
  clientMessageId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ChatConversation {
  id: string;
  franchiseId: string;
  franchiseName: string;
  lastMessageAt: string | null;
}

export interface ChatInboxItem {
  franchiseId: string;
  franchiseName: string;
  location: string;
  status: string;
  conversationId: string | null;
  lastMessageAt: string | null;
  lastMessage: { preview: string; senderRole: ChatRole; createdAt: string } | null;
  unreadCount: number;
}

export interface ChatHistoryPage {
  conversation: ChatConversation;
  messages: ChatMessage[];
  hasMore: boolean;
  peerLastReadAt: string | null;
}

export const CHAT_MAX_LENGTH = 2000;

export const chatApi = {
  getUnread: () => api.get<{ total: number; byConversation: Record<string, number> }>('/api/chat/unread'),
  getInbox: (search?: string) => api.get<{ items: ChatInboxItem[] }>('/api/chat/conversations', { params: search ? { search } : undefined }),
  getMine: () => api.get<{ conversation: ChatConversation; unreadCount: number }>('/api/chat/conversations/mine'),
  openForFranchise: (franchiseId: string) =>
    api.post<{ conversation: ChatConversation; unreadCount: number }>(`/api/chat/conversations/franchise/${franchiseId}`),
  getMessages: (conversationId: string, params?: { before?: string; after?: string; limit?: number }) =>
    api.get<ChatHistoryPage>(`/api/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, content: string, clientMessageId: string) =>
    api.post<{ message: ChatMessage; duplicate: boolean }>(`/api/chat/conversations/${conversationId}/messages`, { content, clientMessageId }),
  markRead: (conversationId: string) => api.post<{ lastReadAt: string | null }>(`/api/chat/conversations/${conversationId}/read`),
};
