import { useState } from 'react'
import { sendFeedback } from '../api/chatApi'
import type { AutoFlag, FeedbackReason, FeedbackRating } from '../types/assistant'
import { ThumbGlyph } from './AssistantIcons'

type Props = {
  answerId: string
  autoFlag: AutoFlag | null
}

const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'wrong', label: '틀린 정보예요' },
  { value: 'bad_source', label: '근거가 이상해요' },
  { value: 'not_found', label: '답을 못 찾았어요' },
  { value: 'misunderstood', label: '질문을 잘못 이해했어요' },
  { value: 'other', label: '기타' },
]

type Status = 'idle' | 'choosing' | 'sending' | 'done' | 'error'

/** 답변 아래 👍/👎. 👎이면 이유를 고르게 하고, 답을 못 찾은 답변이면 먼저 물어본다 */
function ChatFeedback({ answerId, autoFlag }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [reason, setReason] = useState<FeedbackReason | null>(null)
  const [comment, setComment] = useState('')
  const [errorText, setErrorText] = useState('')

  const submit = async (nextRating: FeedbackRating, nextReason: FeedbackReason | null = null) => {
    setRating(nextRating)
    setStatus('sending')
    try {
      await sendFeedback(answerId, nextRating, nextReason, comment)
      setStatus('done')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '평가를 보내지 못했어요.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="kubi-feedback-thanks">
        {rating === 'up' ? '도움이 됐다니 다행이에요!' : '알려주셔서 고마워요. 답변을 고치는 데 쓸게요.'}
      </p>
    )
  }

  if (status === 'choosing' || (status === 'sending' && rating === 'down')) {
    return (
      <div className="kubi-feedback-panel">
        <p>어떤 점이 아쉬웠나요?</p>
        <div className="kubi-feedback-reasons">
          {REASONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={reason === item.value ? 'is-selected' : undefined}
              aria-pressed={reason === item.value}
              onClick={() => setReason(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={comment}
          maxLength={300}
          placeholder="정확한 내용을 알려주시면 더 좋아요 (선택)"
          onChange={(event) => setComment(event.target.value)}
        />
        <div className="kubi-feedback-actions">
          <button type="button" onClick={() => setStatus('idle')}>취소</button>
          <button
            type="button"
            className="is-primary"
            disabled={!reason || status === 'sending'}
            onClick={() => void submit('down', reason)}
          >
            보내기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={autoFlag ? 'kubi-feedback is-asking' : 'kubi-feedback'}>
      {autoFlag && <span>원하는 답을 찾으셨나요?</span>}
      <button
        type="button"
        aria-label="도움이 됐어요"
        title="도움이 됐어요"
        disabled={status === 'sending'}
        onClick={() => void submit('up')}
      >
        <ThumbGlyph />
      </button>
      <button
        type="button"
        aria-label="아쉬워요"
        title="아쉬워요"
        disabled={status === 'sending'}
        onClick={() => setStatus('choosing')}
      >
        <ThumbGlyph down />
      </button>
      {status === 'error' && <small>{errorText}</small>}
    </div>
  )
}

export default ChatFeedback
