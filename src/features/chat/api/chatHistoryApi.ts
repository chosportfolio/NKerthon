import { getSavedAuthToken } from '../../auth/api/authApi'
import { apiUrl } from '../../../shared/api/url'
import type { ChatItem } from '../types/assistant'

export type ChatConversation = {
  id: number
  title: string
  createdAt: string
  updatedAt: string
  itemCount: number
}

async function historyRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  const response = await fetch(apiUrl(url), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  const data = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new Error(data.message ?? '대화 기록을 처리하지 못했어요.')
  return data
}

export async function getChatConversations() {
  return historyRequest<{ conversations: ChatConversation[] }>('/api/chat/conversations')
}

export async function createChatConversation(title: string) {
  return historyRequest<{ conversation: ChatConversation }>('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function getChatConversation(id: number) {
  return historyRequest<{ conversation: ChatConversation; items: ChatItem[] }>(`/api/chat/conversations/${id}`)
}

export async function appendChatConversationItem(id: number, item: ChatItem) {
  return historyRequest<{ item: ChatItem }>(`/api/chat/conversations/${id}/items`, {
    method: 'POST',
    body: JSON.stringify({ item }),
  })
}

export async function deleteChatConversation(id: number) {
  return historyRequest<{ ok: true }>(`/api/chat/conversations/${id}`, { method: 'DELETE' })
}

