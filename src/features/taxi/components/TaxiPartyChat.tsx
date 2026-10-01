import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getTaxiPartyMessages, sendTaxiPartyMessage } from '../api/taxiPartyApi'
import type { TaxiParty, TaxiPartyMessage } from '../types/taxiParty'

type TaxiPartyChatProps = {
  party: TaxiParty
  onBack: () => void
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function TaxiPartyChat({ party, onBack }: TaxiPartyChatProps) {
  const [messages, setMessages] = useState<TaxiPartyMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const loadMessages = () => {
      getTaxiPartyMessages(party.id)
        .then((nextMessages) => {
          if (active) setMessages(nextMessages)
        })
        .catch((requestError: Error) => {
          if (active) setError(requestError.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    loadMessages()
    const timer = window.setInterval(loadMessages, 3_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [party.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setError('')
    try {
      const saved = await sendTaxiPartyMessage(party.id, message)
      setMessages((current) => [...current, saved])
      setDraft('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '메시지를 보내지 못했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="taxi-section taxi-chat-view">
      <header className="taxi-page-header taxi-chat-header">
        <button type="button" onClick={onBack} aria-label="택시팟 목록으로 돌아가기">←</button>
        <div>
          <span>{party.memberCount}/{party.capacity}명 참여 중</span>
          <h1>{party.departure} → {party.destination}</h1>
        </div>
      </header>

      <div className="taxi-chat-messages" aria-live="polite">
        <div className="taxi-chat-notice">개인 연락처는 채팅에 공개하지 말고, 사람이 많은 장소에서 만나세요.</div>
        {loading ? (
          <div className="taxi-chat-empty">대화를 불러오고 있어요...</div>
        ) : messages.length === 0 ? (
          <div className="taxi-chat-empty"><span>💬</span><strong>첫 메시지를 보내보세요</strong><small>만날 장소와 시간을 확인하면 좋아요.</small></div>
        ) : messages.map((message) => (
          <div className={`taxi-chat-row${message.isMine ? ' is-mine' : ''}`} key={message.id}>
            {!message.isMine && <span className="taxi-chat-sender">{message.senderDepartment} · {message.senderName}</span>}
            <div><p>{message.message}</p><time>{formatMessageTime(message.createdAt)}</time></div>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <form className="taxi-chat-composer" onSubmit={handleSubmit}>
        {error && <p className="taxi-error" role="alert">{error}</p>}
        <div>
          <input value={draft} maxLength={300} onChange={(event) => setDraft(event.target.value)} placeholder="메시지를 입력하세요" aria-label="택시팟 메시지" />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="메시지 보내기">➤</button>
        </div>
      </form>
    </div>
  )
}

export default TaxiPartyChat
