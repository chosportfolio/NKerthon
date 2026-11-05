export type ChatLanguage = 'ko' | 'en' | 'zh'

export type ChatSource = {
  n: number[]
  title: string
  url: string
  kind: string | null
  note: string
  page: number | null
  cited: boolean
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

/** 챗봇에 같이 보내는 '내 시간표' 수업 한 개 */
export type TimetableCourse = {
  name: string
  credits: number
  professor: string
  meetings: Array<{ day: string; startTime: string; endTime: string; room: string }>
}

export type ChatResponse = {
  bubbles: string[]
  sources: ChatSource[]
  clarify: string | null
  answer: string
  answerId: string | null
  autoFlag: AutoFlag | null
}

/** 서버가 자동으로 표시한 '답을 못 찾았을 수 있는' 답변 */
export type AutoFlag = 'uncertain' | 'no_source'

export type FeedbackRating = 'up' | 'down'

export type FeedbackReason = 'wrong' | 'bad_source' | 'not_found' | 'misunderstood' | 'other'

export type ChatLink = {
  text: string
  url: string
}

export type ChatItem =
  | { id: string; kind: 'user'; text: string; time: string }
  | { id: string; kind: 'bot'; text: string; time: string; links?: ChatLink[] }
  | { id: string; kind: 'sources'; sources: ChatSource[] }
  | { id: string; kind: 'feedback'; answerId: string; autoFlag: AutoFlag | null }
  | { id: string; kind: 'error'; text: string; retryText: string }

export type SuggestionIcon = 'graduation' | 'calendar' | 'scholarship' | 'bus' | 'health' | 'book' | 'card'

export type Suggestion = {
  icon: SuggestionIcon
  text: string
}
