import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../../../shared/components/AppHeader'
import { loadAcademicCalendar, type AcademicCalendarEvent } from '../api/academicCalendarApi'
import { currentAcademicTerm } from '../../schedule/constants/academicTerms'
import { loadScheduleCourses } from '../../schedule/utils/scheduleStorage'
import { getCourseMeetings } from '../../schedule/utils/courseMeetings'
import type { CourseDay, ScheduleCourse } from '../../schedule/types/schedule'
import HomeBanner from './HomeBanner'
import tlsIcon from '../../../assets/TLS.png'
import academicSystemIcon from '../../../assets/AcademicInformationSystem.png'
import courseRegistrationIcon from '../../../assets/CourseRegistration.png'
import libraryIcon from '../../../assets/Library.png'

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
  { icon: '🏫', label: '학교 홈페이지', color: 'amber', href: 'https://www.kku.ac.kr/index.do' },
  { image: tlsIcon, label: 'TLS', color: 'blue', href: 'https://tls.kku.ac.kr/login.php' },
  { image: academicSystemIcon, label: '학사정보', color: 'green', href: 'https://kis.kku.ac.kr/index.do' },
  { image: courseRegistrationIcon, label: '수강신청', color: 'purple', href: 'https://kupis.kku.ac.kr/wsugang/' },
  { image: libraryIcon, label: '중원도서관', color: 'blue', href: 'https://lib.kku.ac.kr/' },
  { icon: '🚕', label: '택시팟', color: 'green' },
]

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
  const courses = useMemo(() => loadScheduleCourses(userId), [userId])
  const upcomingCourses = useMemo(() => getUpcomingCourses(courses, now), [courses, now])
  const nextCourse = upcomingCourses[0]
  const featuredEvent = useMemo(
    () => getFeaturedCalendarEvent(calendarEvents, now),
    [calendarEvents, now],
  )

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
            <span className={`quick-link-icon ${item.color}`} aria-hidden="true">
              {item.image ? <img src={item.image} alt="" /> : item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        ) : (
          <button type="button" key={item.label} onClick={onOpenTaxi}>
            <span className={`quick-link-icon ${item.color}`} aria-hidden="true">{item.icon}</span>
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
        <article>
          <span>오늘 점심 · 학생식당</span>
          <strong>제육볶음</strong>
          <small>된장국 · 계란말이</small>
        </article>
      </section>

      <HomeBanner />

      </div>
    </div>
  )
}

export default HomeSection

