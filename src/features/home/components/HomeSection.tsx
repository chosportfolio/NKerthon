import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AppHeader from '../../../shared/components/AppHeader'
import type { HeaderNotification } from '../../../shared/components/AppHeader'
import { loadAcademicCalendar, type AcademicCalendarEvent } from '../api/academicCalendarApi'
import { currentAcademicTerm } from '../../schedule/constants/academicTerms'
import { SCHEDULE_SYNCED_EVENT, loadScheduleCourses } from '../../schedule/utils/scheduleStorage'
import { getCourseMeetings } from '../../schedule/utils/courseMeetings'
import type { CourseDay, ScheduleCourse } from '../../schedule/types/schedule'
import { PLACES } from '../../map/data/places'
import { REPRESENTATIVE_MENUS } from '../../map/data/menus'
import HomeBanner from './HomeBanner'

type HomeSectionProps = {
  userId: number
  userName: string
  profileImage: string | null
  onOpenProfile: () => void
  suggestedQuestion: string
  onOpenAssistant: (prompt: string) => void
  onOpenTaxi: () => void
}

const quickLinks = [
  { icon: 'brand', label: '학교 홈페이지', href: 'https://www.kku.ac.kr/index.do' },
  { icon: 'tls', label: 'TLS', href: 'https://tls.kku.ac.kr/login.php' },
  { icon: 'academic', label: '학사정보', href: 'https://kis.kku.ac.kr/index.do' },
  { icon: 'course', label: '수강신청', href: 'https://kupis.kku.ac.kr/wsugang/' },
  { icon: 'library', label: '중원도서관', href: 'https://lib.kku.ac.kr/' },
  { icon: 'taxi', label: '택시팟', href: null },
] as const

type QuickLinkIconKind = (typeof quickLinks)[number]['icon']

function QuickLinkIcon({ kind }: { kind: QuickLinkIconKind }) {
  const paths: Record<QuickLinkIconKind, ReactNode> = {
    brand: <><path d="m3 10 9-6 9 6" /><path d="M5 10v10h14V10M9 20v-6h6v6M3 20h18" /><path d="M8 10h8" /></>,
    tls: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 22h8M12 19v3M10 9l5 3-5 3V9Z" /></>,
    academic: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h5M10 12h6M10 16h6" /></>,
    course: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h4M8 16h3M15 15l1.5 1.5L20 13" /></>,
    library: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" /></>,
    taxi: <><path d="m5 10 2-5h10l2 5M4 10h16v8H4z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M9 5V3h6v2M7 13h.01M17 13h.01" /></>,
  }

  return (
    <span className={`quick-link-icon ${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[kind]}</svg>
    </span>
  )
}

const weekdayNumbers: Record<CourseDay, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function getUpcomingCourses(courses: ScheduleCourse[], now: Date) {
  const currentWeekMinute = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()

  return courses
    .filter((course) => course.term === currentAcademicTerm)
    .flatMap((course) => getCourseMeetings(course).map((meeting) => ({ course, meeting })))
    .map(({ course, meeting }) => {
      const courseDay = weekdayNumbers[meeting.day]
      const startMinute = courseDay * 1440 + timeToMinutes(meeting.startTime)
      const endMinute = courseDay * 1440 + timeToMinutes(meeting.endTime)
      const inProgress = currentWeekMinute >= startMinute && currentWeekMinute < endMinute
      let minutesUntil = inProgress ? 0 : startMinute - currentWeekMinute

      if (minutesUntil <= 0 && !inProgress) minutesUntil += 7 * 1440
      return { course, meeting, minutesUntil, inProgress }
    })
    .sort((first, second) => first.minutesUntil - second.minutesUntil)
}

function formatCountdown(minutesUntil: number, inProgress: boolean, day: CourseDay) {
  if (inProgress) return '수업 중'
  if (minutesUntil < 60) return `${minutesUntil}분 후`
  if (minutesUntil < 24 * 60) {
    const hours = Math.floor(minutesUntil / 60)
    const minutes = minutesUntil % 60
    return minutes ? `${hours}시간 ${minutes}분 후` : `${hours}시간 후`
  }
  return `${day}요일`
}

const dayInMilliseconds = 24 * 60 * 60 * 1000

function parseCalendarDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getFeaturedCalendarEvent(events: AcademicCalendarEvent[], now: Date) {
  const today = startOfDay(now).getTime()
  return events
    .map((event) => {
      const start = parseCalendarDate(event.startDate).getTime()
      const end = parseCalendarDate(event.endDate).getTime()
      return { event, start, end }
    })
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end >= today)
    .sort((first, second) => {
      const firstActive = first.start <= today && today <= first.end
      const secondActive = second.start <= today && today <= second.end
      if (firstActive !== secondActive) return firstActive ? -1 : 1
      if (firstActive && secondActive) {
        const firstStartsToday = first.start === today
        const secondStartsToday = second.start === today
        if (firstStartsToday !== secondStartsToday) return firstStartsToday ? -1 : 1
        return second.start - first.start
      }
      return first.start - second.start
    })[0]
}

function formatEventCountdown(start: number, end: number, now: Date) {
  const today = startOfDay(now).getTime()
  if (start <= today && today <= end) return start === end ? 'D-DAY' : '진행 중'
  return `D-${Math.ceil((start - today) / dayInMilliseconds)}`
}

function formatEventPeriod(event: AcademicCalendarEvent) {
  const format = (date: string) => {
    const [, month, day] = date.split('-')
    return `${month}.${day}`
  }
  const start = format(event.startDate)
  return event.startDate === event.endDate ? start : `${start} – ${format(event.endDate)}`
}

function formatEventTitle(title: string) {
  return title.replace(/\s*\([^)]*(?:\([^)]*\)[^)]*)?\)\s*$/, '').trim()
}

function stableIndex(value: string, length: number) {
  let hash = 0
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash) % length
}

function getMealRecommendation(now: Date, userId: number) {
  const hour = now.getHours()
  const meal: 'lunch' | 'dinner' = hour >= 5 && hour < 17 ? 'lunch' : 'dinner'
  const candidates = PLACES.filter((place) => {
    if (!REPRESENTATIVE_MENUS[place.id]) return false
    return meal === 'lunch' ? place.category === '밥집' : place.category === '밥집' || place.category === '술집'
  })
  const dateKey = `${userId}-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${meal}`
  const place = candidates[stableIndex(dateKey, candidates.length)]
  return {
    label: meal === 'lunch' ? '점심 메뉴 추천' : '저녁 메뉴 추천',
    place,
    menu: place ? REPRESENTATIVE_MENUS[place.id] : '',
  }
}

function HomeSection({
  userId,
  userName,
  profileImage,
  onOpenProfile,
  suggestedQuestion,
  onOpenAssistant,
  onOpenTaxi,
}: HomeSectionProps) {
  const [now, setNow] = useState(() => new Date())
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>([])
  const [courses, setCourses] = useState(() => loadScheduleCourses(userId))
  useEffect(() => {
    const reload = () => setCourses(loadScheduleCourses(userId))     // 서버 시간표를 받아 오면 '다음 수업' 갱신
    window.addEventListener(SCHEDULE_SYNCED_EVENT, reload)
    return () => window.removeEventListener(SCHEDULE_SYNCED_EVENT, reload)
  }, [userId])
  const upcomingCourses = useMemo(() => getUpcomingCourses(courses, now), [courses, now])
  const nextCourse = upcomingCourses[0]
  const featuredEvent = useMemo(
    () => getFeaturedCalendarEvent(calendarEvents, now),
    [calendarEvents, now],
  )
  const mealRecommendation = useMemo(() => getMealRecommendation(now, userId), [now, userId])
  const notifications = useMemo<HeaderNotification[]>(() => {
    const items: HeaderNotification[] = []
    if (nextCourse) {
      items.push({
        id: `course-${nextCourse.course.id}-${nextCourse.meeting.day}-${nextCourse.meeting.startTime}`,
        kind: 'course',
        title: `다음 수업 · ${nextCourse.course.name}`,
        body: `${nextCourse.meeting.day}요일 ${nextCourse.meeting.startTime} · ${nextCourse.meeting.room || '강의실 미정'}`,
        meta: formatCountdown(nextCourse.minutesUntil, nextCourse.inProgress, nextCourse.meeting.day),
      })
    }
    if (featuredEvent) {
      items.push({
        id: `calendar-${featuredEvent.event.startDate}-${featuredEvent.event.title}`,
        kind: 'calendar',
        title: formatEventTitle(featuredEvent.event.title),
        body: `학사일정 · ${formatEventPeriod(featuredEvent.event)}`,
        meta: formatEventCountdown(featuredEvent.start, featuredEvent.end, now),
      })
    }
    return items
  }, [featuredEvent, nextCourse, now])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadAcademicCalendar(controller.signal)
      .then(setCalendarEvents)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <div className="home-section">
      <AppHeader
        userName={userName}
        profileImage={profileImage}
        onOpenProfile={onOpenProfile}
        notifications={notifications}
      />
      <div className="home-dashboard">
      <button
        className="assistant-banner"
        type="button"
        onClick={() => onOpenAssistant(suggestedQuestion)}
      >
        <span className="assistant-banner-icon" aria-hidden="true">✦</span>
        <span>
          <strong>AI 선배에게 물어보기</strong>
          <small>“{suggestedQuestion}”</small>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19 19 5M9 5h10v10" />
        </svg>
      </button>

      <section className="dashboard-block">
        <div className="section-heading">
          <h2>다음 수업</h2>
          {nextCourse && (
            <strong>{formatCountdown(nextCourse.minutesUntil, nextCourse.inProgress, nextCourse.meeting.day)}</strong>
          )}
        </div>
        {nextCourse ? (
          <article className="next-class-card">
            <div className="class-accent"></div>
            <div className="class-main">
              <h3>{nextCourse.course.name}</h3>
              <p>{nextCourse.meeting.startTime} – {nextCourse.meeting.endTime} · {nextCourse.course.professor || nextCourse.course.detail}</p>
              <small>
                {upcomingCourses.slice(1, 3).map(({ course, meeting }) => (
                  `${meeting.day} ${meeting.startTime} ${course.name}`
                )).join('  ·  ') || '등록된 다음 수업이 없습니다.'}
              </small>
            </div>
            <div className="class-location">
              <strong>{nextCourse.meeting.room}</strong>
              <span>⌖ 강의실</span>
            </div>
          </article>
        ) : (
          <article className="next-class-card next-class-empty">
            <div className="class-main">
              <h3>등록된 수업이 없습니다</h3>
              <p>시간표 탭에서 이번 학기 수업을 추가해 주세요.</p>
            </div>
          </article>
        )}
      </section>

      <section className="quick-links" aria-label="바로가기">
        {quickLinks.map((item) => item.href ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" key={item.label}>
            <QuickLinkIcon kind={item.icon} />
            <span>{item.label}</span>
          </a>
        ) : (
          <button type="button" key={item.label} onClick={onOpenTaxi}>
            <QuickLinkIcon kind={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <section className="summary-grid">
        <article aria-live="polite">
          <span>{featuredEvent ? formatEventTitle(featuredEvent.event.title) : '학사일정'}</span>
          <strong>
            {featuredEvent ? formatEventCountdown(featuredEvent.start, featuredEvent.end, now) : '확인 중'}
          </strong>
          <small>{featuredEvent ? formatEventPeriod(featuredEvent.event) : '일정을 불러오고 있어요'}</small>
        </article>
        <article className="meal-recommendation-card">
          <span>{mealRecommendation.label} · 학교 주변</span>
          <strong>{mealRecommendation.menu || '메뉴를 고르는 중'}</strong>
          <small>{mealRecommendation.place ? `${mealRecommendation.place.name} · ${mealRecommendation.place.hours || '운영시간 확인 필요'}` : '지도 음식점 정보를 확인하고 있어요'}</small>
        </article>
      </section>

      <HomeBanner />

      </div>
    </div>
  )
}

export default HomeSection

