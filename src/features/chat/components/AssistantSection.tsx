import { useEffect, useMemo, useRef } from 'react'
import kuCharacter from '../../../assets/ku_character.png'
import { getSuggestions } from '../constants/suggestions'
import { useAssistantChat } from '../hooks/useAssistantChat'
import '../assistant.css'
import { NewChatGlyph, SuggestionGlyph } from './AssistantIcons'
import ChatComposer from './ChatComposer'
import ChatThread from './ChatThread'

type AssistantSectionProps = {
  initialPrompt: string | null
  userName?: string
  department?: string
  studentNumber?: string
}

function AssistantSection({ initialPrompt, userName = '', department = '', studentNumber = '' }: AssistantSectionProps) {
  const { items, pending, send, retry, reset } = useAssistantChat('ko')
  const suggestions = useMemo(() => getSuggestions(department, studentNumber), [department, studentNumber])
  const sentInitial = useRef<string | null>(null)

  // 홈 화면에서 추천 질문을 눌러 들어온 경우 바로 질문
  useEffect(() => {
    if (!initialPrompt || sentInitial.current === initialPrompt) return
    sentInitial.current = initialPrompt
    void send(initialPrompt)
  }, [initialPrompt, send])

  // 처음 화면: 가운데는 비우고, 추천 질문 3개를 아래 입력창 바로 위에 둔다
  if (items.length === 0 && !pending) {
    return (
      <section className="kubi kubi-empty" aria-label="AI 선배">
        <div className="kubi-hello">
          <img src={kuCharacter} alt="" />
          <h2>{userName ? `${userName}님, 무엇이 궁금하세요?` : '무엇이 궁금하세요?'}</h2>
          <p>학사·장학·학교생활 정보를 학교 자료에서 찾아<br />근거와 함께 알려드려요</p>
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
      </section>
    )
  }

  return (
    <section className="kubi kubi-chat" aria-label="AI 선배">
      <div className="kubi-toolbar">
        <span>AI 선배</span>
        <button type="button" onClick={reset}>
          <NewChatGlyph />
          새 대화
        </button>
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
    </section>
  )
}

export default AssistantSection
