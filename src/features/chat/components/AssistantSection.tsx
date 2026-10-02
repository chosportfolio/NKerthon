import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import kuHappyCharacter from '../../../assets/ku_happy_character.png'
import {
  deleteChatConversation,
  getChatConversations,
  type ChatConversation,
} from '../api/chatHistoryApi'
import { getSuggestions } from '../constants/suggestions'
import { useAssistantChat } from '../hooks/useAssistantChat'
import { getMyTimetable } from '../utils/myTimetable'
import '../assistant.css'
import { NewChatGlyph, SuggestionGlyph } from './AssistantIcons'
import ChatComposer from './ChatComposer'
import ChatThread from './ChatThread'

type AssistantSectionProps = {
  initialPrompt: string | null
  userId: number
  userName?: string
  department?: string
  studentNumber?: string
}

function HistoryGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
      <path d="M4 4v4.6h4.6M12 7.5V12l3 2" />
    </svg>
  )
}

function formatHistoryDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function AssistantSection({ initialPrompt, userId, userName = '', department = '', studentNumber = '' }: AssistantSectionProps) {
  const getTimetable = useCallback(() => getMyTimetable(userId), [userId])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [historyVersion, setHistoryVersion] = useState(0)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const notifyHistoryChange = useCallback(() => setHistoryVersion((version) => version + 1), [])
  const { items, pending, currentConversationId, send, retry, reset, loadConversation } = useAssistantChat(
    'ko',
    getTimetable,
    notifyHistoryChange,
  )
  const suggestions = useMemo(() => getSuggestions(department, studentNumber), [department, studentNumber])
  const sentInitial = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getChatConversations()
      .then(({ conversations: saved }) => {
        if (!cancelled) {
          setConversations(saved)
          setHistoryError('')
        }
      })
      .catch((error) => {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : '대화 기록을 불러오지 못했어요.')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => { cancelled = true }
  }, [historyVersion])

  // 홈 화면에서 추천 질문을 눌러 들어온 경우 바로 질문
  useEffect(() => {
    if (!initialPrompt || sentInitial.current === initialPrompt) return
    sentInitial.current = initialPrompt
    void send(initialPrompt)
  }, [initialPrompt, send])

  const openConversation = async (conversationId: number) => {
    setHistoryError('')
    try {
      await loadConversation(conversationId)
      setHistoryOpen(false)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '대화 기록을 불러오지 못했어요.')
    }
  }

  const removeConversation = async (conversation: ChatConversation) => {
    if (!window.confirm(`“${conversation.title}” 대화를 삭제할까?\n삭제한 대화는 다시 복구할 수 없어.`)) return

    try {
      await deleteChatConversation(conversation.id)
      setConversations((current) => current.filter((item) => item.id !== conversation.id))
      if (currentConversationId === conversation.id) reset()
      setHistoryError('')
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '대화 기록을 삭제하지 못했어요.')
    }
  }

  const historyPanel = historyOpen && (
    <>
      <button className="kubi-history-backdrop" type="button" aria-label="대화 목록 닫기" onClick={() => setHistoryOpen(false)} />
      <aside className="kubi-history-panel" aria-label="저장된 대화 목록">
        <div className="kubi-history-header">
          <div>
            <strong>지난 대화</strong>
            <span>언제든 이어서 물어볼 수 있어</span>
          </div>
          <button type="button" aria-label="닫기" onClick={() => setHistoryOpen(false)}>×</button>
        </div>
        <div className="kubi-history-list">
          {historyLoading && <p className="kubi-history-status">대화 기록을 불러오는 중...</p>}
          {!historyLoading && historyError && <p className="kubi-history-status kubi-history-status-error">{historyError}</p>}
          {!historyLoading && !historyError && conversations.length === 0 && (
            <div className="kubi-history-empty">
              <HistoryGlyph />
              <strong>아직 저장된 대화가 없어</strong>
              <span>질문을 보내면 여기에 자동으로 저장돼.</span>
            </div>
          )}
          {!historyLoading && conversations.map((conversation) => (
            <div
              className={`kubi-history-item${conversation.id === currentConversationId ? ' is-current' : ''}`}
              key={conversation.id}
            >
              <button className="kubi-history-open" type="button" onClick={() => void openConversation(conversation.id)}>
                <strong>{conversation.title}</strong>
                <span>{formatHistoryDate(conversation.updatedAt)}</span>
              </button>
              <button
                className="kubi-history-delete"
                type="button"
                aria-label={`${conversation.title} 대화 삭제`}
                title="대화 삭제"
                onClick={() => void removeConversation(conversation)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  )

  // 처음 화면: 가운데는 비우고, 추천 질문 3개를 아래 입력창 바로 위에 둔다
  if (items.length === 0 && !pending) {
    return (
      <section className="kubi kubi-empty" aria-label="AI 선배">
        <button className="kubi-history-trigger" type="button" onClick={() => setHistoryOpen(true)}>
          <HistoryGlyph />
          지난 대화
        </button>
        <div className="kubi-hello">
          <img src={kuHappyCharacter} alt="활짝 웃는 건국대학교 캐릭터 쿠" />
          <h2>{userName ? `${userName}아, 궁금한 건 선배한테 물어봐!` : '궁금한 건 선배한테 물어봐!'}</h2>
          <p>수업부터 장학금, 학교생활까지<br />선배가 학교 자료를 찾아 꼼꼼히 알려줄게.</p>
        </div>
        <div className="kubi-dock">
          <ul className="kubi-suggestions" aria-label="추천 질문">
            {suggestions.map((suggestion) => (
              <li key={suggestion.text}>
                <button type="button" onClick={() => void send(suggestion.text)}>
                  <SuggestionGlyph icon={suggestion.icon} />
                  <span>{suggestion.text}</span>
                </button>
              </li>
            ))}
          </ul>
          <ChatComposer onSend={send} />
        </div>
        {historyPanel}
      </section>
    )
  }

  return (
    <section className="kubi kubi-chat" aria-label="AI 선배">
      <div className="kubi-toolbar">
        <span>AI 선배</span>
        <div className="kubi-toolbar-actions">
          <button type="button" onClick={() => setHistoryOpen(true)}>
            <HistoryGlyph />
            지난 대화
          </button>
          <button type="button" onClick={reset}>
            <NewChatGlyph />
            새 대화
          </button>
        </div>
      </div>
      <ChatThread items={items} pending={pending} onRetry={retry} />
      <div className="kubi-dock">
        <ChatComposer onSend={send} disabled={pending} placeholder="이어서 물어보세요" />
        <p className="kubi-disclaimer">
          AI 답변은 틀릴 수 있어요. 중요한 내용은 근거 자료에서 확인하세요.
          <br />
          답변 개선을 위해 평가한 대화와 답을 찾지 못한 질문은 이름 없이 저장돼요.
        </p>
      </div>
      {historyPanel}
    </section>
  )
}

export default AssistantSection
