import { useEffect, useMemo, useState } from 'react'
import CourseFormModal from './CourseFormModal'
import GradeCalculator from './GradeCalculator'
import { academicTerms, currentAcademicTerm, formatAcademicTerm } from '../constants/academicTerms'
import { getScheduleStorageKey, loadScheduleCourses } from '../utils/scheduleStorage'
import { getCourseMeetings } from '../utils/courseMeetings'
import type { AcademicTerm, CourseDay, CourseGrade, ScheduleCourse } from '../types/schedule'
import type { CatalogSemester } from '../types/courseCatalog'
import { loadCourseCatalog } from '../services/courseCatalog'

type ScheduleSectionProps = {
  userId: number
  department: string
  studentNumber: string
}

const weekdays: CourseDay[] = ['월', '화', '수', '목', '금']
const gradePoints: Record<CourseGrade, number | null> = {
  'A+': 4.5, A0: 4, 'B+': 3.5, B0: 3, 'C+': 2.5,
  C0: 2, 'D+': 1.5, D0: 1, F: 0, P: null,
}
function timeToSlot(time: string, startHour: number, slotCount: number) {
  const [hour, minute] = time.split(':').map(Number)
  return Math.max(0, Math.min(slotCount, Math.round(((hour - startHour) * 60 + minute) / 30)))
}

function calculateGpa(courses: ScheduleCourse[]) {
  const targets = courses.filter(
    (course): course is ScheduleCourse & { grade: CourseGrade } =>
      Boolean(course.grade) && gradePoints[course.grade as CourseGrade] !== null,
  )
  const credits = targets.reduce((sum, course) => sum + course.credits, 0)
  if (!credits) return '0.00'
  const total = targets.reduce((sum, course) => sum + (gradePoints[course.grade] ?? 0) * course.credits, 0)
  return (total / credits).toFixed(2)
}

function ScheduleSection({ userId, department, studentNumber }: ScheduleSectionProps) {
  const storageKey = getScheduleStorageKey(userId)
  const [courses, setCourses] = useState<ScheduleCourse[]>(() => loadScheduleCourses(userId))
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm>(currentAcademicTerm)
  const [modal, setModal] = useState<'course' | 'calculator' | null>(null)
  const [editingCourse, setEditingCourse] = useState<ScheduleCourse | undefined>()

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(courses))
  }, [courses, storageKey])

  useEffect(() => {
    const missingAreas = courses.filter((course) => course.category === 'liberal' && !course.liberalArea && course.catalogId && course.sourceSemester)
    if (!missingAreas.length) return
    let active = true
    const semesters = [...new Set(missingAreas.map((course) => course.sourceSemester as CatalogSemester))]
    Promise.all(semesters.map((semester) => loadCourseCatalog(semester)))
      .then((payloads) => {
        if (!active) return
        const areas = new Map(payloads.flatMap((payload) => payload.courses.map((course) => [course.id, course.area] as const)))
        setCourses((current) => {
          let changed = false
          const next = current.map((course) => {
            const area = course.catalogId ? areas.get(course.catalogId) : ''
            if (!area || course.liberalArea) return course
            changed = true
            return { ...course, liberalArea: area }
          })
          return changed ? next : current
        })
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [courses])

  const earnedCredits = useMemo(
    () => courses.filter((course) => course.grade && course.grade !== 'F').reduce((sum, course) => sum + course.credits, 0),
    [courses],
  )
  const timetableEntries = courses
    .filter((course) => course.term === selectedTerm && course.detail !== '이러닝')
    .flatMap((course, courseIndex) => getCourseMeetings(course)
      .filter((meeting) => weekdays.includes(meeting.day))
      .map((meeting, meetingIndex) => ({ course, courseIndex, meeting, meetingIndex })))
  const timelessCourses = courses.filter((course) => course.term === selectedTerm && course.detail === '이러닝')
  const timetableStartHour = Math.min(9, ...timetableEntries.map(({ meeting }) => Number(meeting.startTime.slice(0, 2))))
  const timetableEndHour = Math.max(18, ...timetableEntries.map(({ meeting }) => Math.ceil(Number(meeting.endTime.slice(0, 2)) + Number(meeting.endTime.slice(3, 5)) / 60)))
  const timetableSlotCount = Math.max(18, (timetableEndHour - timetableStartHour) * 2)

  const updateGrade = (courseId: string, grade: CourseGrade | undefined) => {
    setCourses((current) => current.map((course) => course.id === courseId ? { ...course, grade } : course))
  }

  return (
    <section className="schedule-page">
      <header className="schedule-page-header">
        <div>
          <label className="schedule-term-picker">
            <span className="sr-only">시간표 학기 선택</span>
            <select value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value as AcademicTerm)}>
              {[...academicTerms].reverse().map((term) => <option value={term} key={term}>{formatAcademicTerm(term)}</option>)}
            </select>
          </label>
        </div>
        <div className="schedule-header-actions">
          <button
            type="button"
            onClick={() => {
              setEditingCourse(undefined)
              setModal('course')
            }}
            aria-label="시간표 추가"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" onClick={() => setModal('calculator')} aria-label="학점 계산기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5zM8 7h8M8 11h2M14 11h2M8 15h2M14 15h2" /></svg>
          </button>
        </div>
      </header>

      <div className="timetable-shell">
        <div className="timetable-grid" style={{ gridTemplateRows: `30px repeat(${timetableSlotCount}, minmax(0, 1fr))` }}>
          <div className="timetable-corner" />
          {weekdays.map((day, index) => (
            <div className="timetable-day-header" style={{ gridColumn: index + 2 }} key={day}>{day}</div>
          ))}
          {weekdays.map((day, index) => (
            <div className="timetable-day-column" style={{ gridColumn: index + 2, gridRow: `2 / ${timetableSlotCount + 2}`, backgroundSize: `100% ${100 / timetableSlotCount}%` }} key={`${day}-column`} />
          ))}
          {Array.from({ length: timetableEndHour - timetableStartHour }, (_, index) => timetableStartHour + index).map((hour, index) => (
            <time className="timetable-hour" style={{ gridRow: index * 2 + 2 }} key={hour}>
              {hour > 12 ? hour - 12 : hour}
            </time>
          ))}
          {timetableEntries.map(({ course, courseIndex, meeting, meetingIndex }) => {
            const startSlot = timeToSlot(meeting.startTime, timetableStartHour, timetableSlotCount)
            const endSlot = Math.max(startSlot + 1, timeToSlot(meeting.endTime, timetableStartHour, timetableSlotCount))
            return (
              <button
                type="button"
                className={`timetable-course course-color-${courseIndex % 6}`}
                style={{
                  gridColumn: weekdays.indexOf(meeting.day) + 2,
                  gridRow: `${startSlot + 2} / ${endSlot + 2}`,
                }}
                title={`${course.name} · ${course.professor || '담당교수 미정'} · ${meeting.room}`}
                aria-label={`${course.name} 수업 정보 수정`}
                onClick={() => {
                  setEditingCourse(course)
                  setModal('course')
                }}
                key={`${course.id}-${meetingIndex}`}
              >
                <strong>{course.name}</strong>
                <span>{course.professor || course.detail}</span>
                <small>{meeting.room}</small>
              </button>
            )
          })}
        </div>
      </div>

      {timelessCourses.length > 0 && (
        <section className="timeless-course-section" aria-label="시간 없는 온라인 강의">
          <div className="timeless-course-section-title">
            <strong>E-러닝 · 사이버 강의</strong><span>{timelessCourses.length}과목</span>
          </div>
          <div className="timeless-course-list">
            {timelessCourses.map((course) => (
              <button type="button" key={course.id} onClick={() => { setEditingCourse(course); setModal('course') }}>
                <span><strong>{course.name}</strong><small>{course.professor || '담당교수 미정'}</small></span>
                <em>{course.credits}학점</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <button className="grade-preview-card" type="button" onClick={() => setModal('calculator')}>
        <span><strong>전체 학점 계산기</strong><small>전 학기 누적 성적을 확인해 보세요</small></span>
        <span><em>누적 평점</em><b>{calculateGpa(courses)}</b><small>/ 4.5</small></span>
        <span><em>누적 학점</em><b>{earnedCredits}</b><small>학점</small></span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>

      {modal === 'course' && (
        <CourseFormModal
          initialTerm={selectedTerm}
          initialCourse={editingCourse}
          courses={courses}
          onClose={() => {
            setEditingCourse(undefined)
            setModal(null)
          }}
          onSave={(course) => {
            setCourses((current) => {
              const exists = current.some((item) => item.id === course.id)
              return exists
                ? current.map((item) => item.id === course.id ? course : item)
                : [...current, course]
            })
            setSelectedTerm(course.term)
            setEditingCourse(undefined)
            setModal(null)
          }}
          onDelete={(courseId) => {
            setCourses((current) => current.filter((course) => course.id !== courseId))
            setEditingCourse(undefined)
            setModal(null)
          }}
        />
      )}
      {modal === 'calculator' && (
        <GradeCalculator
          courses={courses}
          initialTerm={selectedTerm}
          department={department}
          studentNumber={studentNumber}
          onClose={() => setModal(null)}
          onGradeChange={updateGrade}
          onAdd={(course) => setCourses((current) => [...current, course])}
          onDelete={(courseId) => setCourses((current) => current.filter((course) => course.id !== courseId))}
        />
      )}
    </section>
  )
}

export default ScheduleSection
