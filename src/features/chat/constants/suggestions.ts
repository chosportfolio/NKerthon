import type { Suggestion } from '../types/assistant'

/** 학과·학번에 상관없이 자주 묻는 질문 — 챗봇 평가에서 정답률이 확인된 유형 위주 */
const commonSuggestions: Suggestion[] = [
  { icon: 'calendar', text: '이번 학기 중간고사 언제야?' },
  { icon: 'calendar', text: '기말고사 일정 알려줘' },
  { icon: 'scholarship', text: '국가장학금 신청 기간 알려줘' },
  { icon: 'bus', text: '동서울 가는 통학버스 시간 알려줘' },
  { icon: 'health', text: '보건실 몇 시까지 열어?' },
  { icon: 'card', text: '학생증 재발급 어떻게 해?' },
  { icon: 'book', text: '휴학 신청은 언제까지 할 수 있어?' },
  { icon: 'book', text: '계절학기는 최대 몇 학점까지 들을 수 있어?' },
]

const shuffle = <T,>(items: T[]) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** 첫 번째는 로그인한 학생 맞춤 질문, 나머지 두 개는 아이콘이 겹치지 않게 무작위 */
export function getSuggestions(department: string, studentNumber: string): Suggestion[] {
  const year = studentNumber.match(/^20(\d{2})/)?.[1]
  const personal: Suggestion = department && year
    ? { icon: 'graduation', text: `${department} ${year}학번 졸업학점 알려줘` }
    : { icon: 'graduation', text: '졸업 요건 알려줘' }

  const picked: Suggestion[] = []
  for (const suggestion of shuffle(commonSuggestions)) {
    if (picked.some((item) => item.icon === suggestion.icon)) continue
    picked.push(suggestion)
    if (picked.length === 2) break
  }

  return [personal, ...picked]
}
