export type AcademicCalendarEvent = {
  startDate: string
  endDate: string
  title: string
}

type AcademicCalendarResponse = {
  events?: AcademicCalendarEvent[]
}

// 공식 일정 API가 일시적으로 닫혀 있어도 홈 카드가 빈칸이 되지 않도록
// 마지막으로 수집한 건국대 글로컬캠퍼스 2026 학사일정을 사용한다.
const fallbackEvents: AcademicCalendarEvent[] = [
  { startDate: '2026-02-20', endDate: '2026-02-20', title: '2026년도 전기 학위수여식' },
  { startDate: '2026-03-03', endDate: '2026-03-03', title: '2026학년도 1학기 개강(학기개시일)' },
  { startDate: '2026-04-08', endDate: '2026-04-08', title: '수업일수 1/3선' },
  { startDate: '2026-04-21', endDate: '2026-04-27', title: '중간고사 (4.20.(월)까지 등록휴학 가능)' },
  { startDate: '2026-05-12', endDate: '2026-05-12', title: '학원창립 95주년 기념일' },
  { startDate: '2026-05-15', endDate: '2026-05-15', title: '개교 80주년 기념일' },
  { startDate: '2026-06-16', endDate: '2026-06-22', title: '기말고사' },
  { startDate: '2026-06-23', endDate: '2026-08-30', title: '하계방학' },
  { startDate: '2026-08-31', endDate: '2026-08-31', title: '2026학년도 2학기 개강(학기개시일)' },
  { startDate: '2026-10-06', endDate: '2026-10-06', title: '수업일수 1/3선' },
  { startDate: '2026-10-19', endDate: '2026-10-23', title: '중간고사 (10.18.(일)까지 등록휴학 가능)' },
  { startDate: '2026-12-14', endDate: '2026-12-18', title: '기말고사' },
  { startDate: '2026-12-21', endDate: '2027-02-26', title: '동계방학' },
]

function isCalendarEvent(value: unknown): value is AcademicCalendarEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  return typeof event.startDate === 'string'
    && typeof event.endDate === 'string'
    && typeof event.title === 'string'
}

export async function loadAcademicCalendar(signal?: AbortSignal) {
  try {
    const response = await fetch('/api/academic-calendar', { signal })
    if (!response.ok) throw new Error('학사일정을 불러오지 못했습니다.')
    const data = await response.json() as AcademicCalendarResponse
    const events = Array.isArray(data.events) ? data.events.filter(isCalendarEvent) : []
    return events.length > 0 ? events : fallbackEvents
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return fallbackEvents
  }
}

