import { useEffect, useRef } from 'react'
import kuCharacter from '../../../assets/ku_character.png'
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
              <p className="kubi-bubble kubi-bubble-user">{item.text}</p>
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
                {item.sources.map((source) => (
                  <a key={`${source.url}-${source.n.join()}`} className="kubi-source" href={source.url}
                    target="_blank" rel="noopener noreferrer">
                    <span className="kubi-source-n">{source.cited ? source.n.join(',') : '참고'}</span>
                    <span className="kubi-source-body">
                      <strong>{source.title}</strong>
                      <small>{[KIND_LABEL[source.kind ?? ''], source.note].filter(Boolean).join(' · ')}</small>
                    </span>
                    <LinkGlyph />
                  </a>
                ))}
              </div>
            </div>
          )
        }

        return (
          <div key={item.id} className="kubi-row kubi-row-bot">
            {firstOfBotGroup
              ? <img className="kubi-avatar" src={kuCharacter} alt="쿠비" />
              : <span className="kubi-avatar-space" />}
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
          </div>
        )
      })}

      {pending && (
        <div className="kubi-row kubi-row-bot">
          {items.at(-1)?.kind === 'user'
            ? <img className="kubi-avatar" src={kuCharacter} alt="쿠비" />
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
