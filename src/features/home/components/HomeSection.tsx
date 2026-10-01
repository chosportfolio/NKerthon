import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../../../shared/components/AppHeader'
import { currentAcademicTerm } from '../../schedule/constants/academicTerms'
import { loadScheduleCourses } from '../../schedule/utils/scheduleStorage'
import { getCourseMeetings } from '../../schedule/utils/courseMeetings'
import type { CourseDay, ScheduleCourse } from '../../schedule/types/schedule'

type HomeSectionProps = {
  userId: number
  userName: string
  profileImage: string | null
  onOpenProfile: () => void
  suggestedQuestion: string
  onOpenAssistant: (prompt: string) => void
}

const quickLinks = [
  { icon: '🍴', label: '학식', color: 'amber' },
  { icon: '🚌', label: '통학버스', color: 'blue' },
  { icon: '🗺️', label: '캠퍼스맵', color: 'green' },
  { icon: '🗓️', label: '학사일정', color: 'purple' },
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

function HomeSection({
  userId,
  userName,
  profileImage,
  onOpenProfile,
  suggestedQuestion,
  onOpenAssistant,
}: HomeSectionProps) {
  const [now, setNow] = useState(() => new Date())
  const courses = useMemo(() => loadScheduleCourses(userId), [userId])
  const upcomingCourses = useMemo(() => getUpcomingCourses(courses, now), [courses, now])
  const nextCourse = upcomingCourses[0]

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
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
        {quickLinks.map((item) => (
          <button type="button" key={item.label}>
            <span className={`quick-link-icon ${item.color}`} aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <section className="summary-grid">
        <article>
          <span>중간고사</span>
          <strong>D-18</strong>
          <small>10.19 – 10.23</small>
        </article>
        <article>
          <span>오늘 점심 · 학생식당</span>
          <strong>제육볶음</strong>
          <small>된장국 · 계란말이</small>
        </article>
      </section>

      <section className="dashboard-list">
        <div className="section-heading">
          <h2>꼭 봐야 할 공지</h2>
          <button type="button">더보기</button>
        </div>
        <ul>
          <li><span className="tag scholarship">장학</span><strong>국가근로장학금 희망근로지 추가신청</strong><time>D-3</time></li>
          <li><span className="tag academic">학사</span><strong>2학기 수강포기 신청 안내</strong><time>10.06</time></li>
        </ul>
      </section>

      <section className="dashboard-list popular-list">
        <div className="section-heading">
          <h2>지금 뜨는 글</h2>
        </div>
        <ul>
          <li><strong>해오름 3인실 룸메 구해요</strong><span>♡ 24&nbsp;&nbsp;▢ 12</span></li>
          <li><strong>자료구조 중간 범위 아시는 분</strong><span>♡ 9&nbsp;&nbsp;▢ 31</span></li>
        </ul>
      </section>
      </div>
    </div>
  )
}

export default HomeSection

