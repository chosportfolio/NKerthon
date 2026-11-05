import { useEffect, useRef } from 'react'
import kuChatAvatar from '../../../assets/ku_chat_avatar.png'
import type { ChatItem } from '../types/assistant'
import { LinkGlyph } from './AssistantIcons'
import ChatFeedback from './ChatFeedback'
import RichText from './RichText'

type Props = {
  items: ChatItem[]
  pending: boolean
  onRetry: (text: string) => void
}

const KIND_LABEL: Record<string, string> = {
  yoram: '학사요람',
  post: '공지',
  page: '학교 홈페이지',
  manual: '정리 자료',
  schedule: '학사일정',
  catalog: '강의시간표',
  timetable: '내 시간표',
}

function ChatThread({ items, pending, onRetry }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items, pending])

  return (
    <div className="kubi-thread" role="log" aria-live="polite">
      {items.map((item, index) => {
        const previous = items[index - 1]
        const firstOfBotGroup = item.kind !== 'user' && previous?.kind !== 'bot' && previous?.kind !== 'sources'

        if (item.kind === 'user') {
          return (
            <div key={item.id} className="kubi-row kubi-row-user">
              <div className="kubi-message kubi-message-user">
                <p className="kubi-bubble kubi-bubble-user">{item.text}</p>
                <time className="kubi-message-time">{item.time}</time>
              </div>
            </div>
          )
        }

        if (item.kind === 'error') {
          return (
            <div key={item.id} className="kubi-row kubi-row-bot">
              <span className="kubi-avatar-space" />
              <div className="kubi-error">
                <p>{item.text}</p>
                <button type="button" onClick={() => onRetry(item.retryText)}>다시 시도</button>
              </div>
            </div>
          )
        }

        if (item.kind === 'feedback') {
          return (
            <div key={item.id} className="kubi-row kubi-row-bot">
              <span className="kubi-avatar-space" />
              <ChatFeedback answerId={item.answerId} autoFlag={item.autoFlag} />
            </div>
          )
        }

        if (item.kind === 'sources') {
          return (
            <div key={item.id} className="kubi-row kubi-row-bot">
              <span className="kubi-avatar-space" />
              <div className="kubi-sources">
                <p className="kubi-sources-title">근거 자료</p>
                {item.sources.map((source) => {
                  const body = (
                    <>
                      <span className="kubi-source-n">{source.cited ? source.n.join(',') : '참고'}</span>
                      <span className="kubi-source-body">
                        <strong>{source.title}</strong>
                        <small>{[KIND_LABEL[source.kind ?? ''], source.note].filter(Boolean).join(' · ')}</small>
                      </span>
                    </>
                  )
                  const key = `${source.url || source.title}-${source.n.join()}`
                  // 강의시간표·내 시간표처럼 링크가 없는 자료는 누를 수 없는 카드로
                  return source.url ? (
                    <a key={key} className="kubi-source" href={source.url} target="_blank" rel="noopener noreferrer">
                      {body}
                      <LinkGlyph />
                    </a>
                  ) : (
                    <div key={key} className="kubi-source kubi-source-static">{body}</div>
                  )
                })}
              </div>
            </div>
          )
        }

        return (
          <div key={item.id} className="kubi-row kubi-row-bot">
            {firstOfBotGroup
              ? <img className="kubi-avatar" src={kuChatAvatar} alt="AI 선배 쿠" />
              : <span className="kubi-avatar-space" />}
            <div className="kubi-message kubi-message-bot">
              <div className="kubi-bubble kubi-bubble-bot">
                <p><RichText text={item.text} /></p>
                {item.links && item.links.length > 0 && (
                  <div className="kubi-links">
                    {item.links.map((link) => (
                      <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.text}</a>
                    ))}
                  </div>
                )}
              </div>
              <time className="kubi-message-time">{item.time}</time>
            </div>
          </div>
        )
      })}

      {pending && (
        <div className="kubi-row kubi-row-bot">
          {items.at(-1)?.kind === 'user'
            ? <img className="kubi-avatar" src={kuChatAvatar} alt="AI 선배 쿠" />
            : <span className="kubi-avatar-space" />}
          <div className="kubi-bubble kubi-bubble-bot kubi-typing" aria-label="답변을 만드는 중">
            <span /><span /><span />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default ChatThread
