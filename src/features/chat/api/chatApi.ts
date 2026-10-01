import { getSavedAuthToken } from '../../auth/api/authApi'
import type {
  ChatLanguage,
  ChatResponse,
  ChatTurn,
  FeedbackRating,
  FeedbackReason,
} from '../types/assistant'

/** 챗봇 서버가 꺼져 있을 때 — 화면은 키워드 메뉴 안내로 대체한다 */
export class ChatbotUnavailableError extends Error {}

export async function askChatbot(question: string, history: ChatTurn[], language: ChatLanguage) {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question, history: history.slice(-6), language }),
    })
  } catch {
    throw new ChatbotUnavailableError('서버에 연결할 수 없습니다.')
  }

  const data = (await response.json().catch(() => ({}))) as Partial<ChatResponse> & {
    message?: string
    fallback?: boolean
  }

  if (response.status === 503 && data.fallback) {
    throw new ChatbotUnavailableError(data.message ?? '챗봇 서버에 연결할 수 없습니다.')
  }
  if (!response.ok) {
    throw new Error(data.message ?? '답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
  }

  return {
    bubbles: data.bubbles ?? [],
    sources: data.sources ?? [],
    clarify: data.clarify ?? null,
    answer: data.answer ?? '',
    answerId: data.answerId ?? null,
    autoFlag: data.autoFlag ?? null,
  } satisfies ChatResponse
}

export async function sendFeedback(
  answerId: string,
  rating: FeedbackRating,
  reason: FeedbackReason | null = null,
  comment = '',
) {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  const response = await fetch('/api/chat/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ answerId, rating, reason, comment }),
  })
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(data.message ?? '평가를 보내지 못했어요.')
  }
}
