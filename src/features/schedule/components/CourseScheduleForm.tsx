import { useState } from 'react'
import type { FormEvent } from 'react'
import { academicTerms, formatAcademicTerm } from '../constants/academicTerms'
import type { CatalogCourse, CatalogSemester } from '../types/courseCatalog'
import type { AcademicTerm, CourseCategory, CourseDay, CourseMeeting, ScheduleCourse } from '../types/schedule'
import { getCourseMeetings, meetingsOverlap, parseCatalogMeetings } from '../utils/courseMeetings'
import { inferLiberalArea, liberalAreaOptions } from '../constants/liberalAreas'

type CourseScheduleFormProps = {
  initialTerm: AcademicTerm
  initialCourse?: ScheduleCourse
  catalogCourse?: CatalogCourse
  catalogSemester?: CatalogSemester
  courses: ScheduleCourse[]
  onBack?: () => void
  onClose: () => void
  onSave: (course: ScheduleCourse) => void
  onDelete?: (courseId: string) => void
}

const detailOptions = {
  major: ['전필', '전선'],
  liberal: ['기초', '심화', '소양'],
  other: ['자선', '교직', '이러닝', '일선'],
} satisfies Record<CourseCategory, string[]>

const classTimes = Array.from({ length: 31 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
})

const blankMeeting = (): CourseMeeting => ({ day: '월', startTime: '09:00', endTime: '10:30', room: '' })

function categoryFromCatalog(course?: CatalogCourse): CourseCategory {
  if (!course) return 'major'
  if (course.isElearning) return 'other'
  if (['전필', '전선'].includes(course.classification)) return 'major'
  if (['기초', '심화', '소양'].includes(course.classification)) return 'liberal'
  return 'other'
}

function detailFromCatalog(course?: CatalogCourse) {
  if (!course) return '전필'
  if (course.isElearning) return '이러닝'
  return course.classification || '자선'
}

function CourseScheduleForm({ initialTerm, initialCourse, catalogCourse, catalogSemester, courses, onBack, onClose, onSave, onDelete }: CourseScheduleFormProps) {
  const automaticMeetings = catalogCourse && !catalogCourse.isElearning ? parseCatalogMeetings(catalogCourse) : []
  const [name, setName] = useState(initialCourse?.name ?? catalogCourse?.name ?? '')
  const [professor, setProfessor] = useState(initialCourse?.professor ?? catalogCourse?.professor ?? '')
  const [term, setTerm] = useState<AcademicTerm>(initialCourse?.term ?? initialTerm)
  const initialCategory = initialCourse?.category ?? categoryFromCatalog(catalogCourse)
  const [category, setCategory] = useState<CourseCategory>(initialCategory)
  const [detail, setDetail] = useState(initialCourse?.detail ?? detailFromCatalog(catalogCourse))
  const [liberalArea, setLiberalArea] = useState(initialCourse ? inferLiberalArea(initialCourse) : catalogCourse?.area ?? '')
  const [credits, setCredits] = useState(initialCourse?.credits ?? catalogCourse?.credits ?? 3)
  const [meetings, setMeetings] = useState<CourseMeeting[]>(() => {
    if (initialCourse) return initialCourse.detail === '이러닝' ? [] : getCourseMeetings(initialCourse)
    if (catalogCourse?.isElearning) return []
    return automaticMeetings.length ? automaticMeetings : [blankMeeting()]
  })
  const [error, setError] = useState('')
  const isEditing = Boolean(initialCourse)
  const isTimelessCourse = detail === '이러닝' || Boolean(catalogCourse?.isElearning)

  const changeCategory = (nextCategory: CourseCategory) => {
    setCategory(nextCategory)
    const nextDetail = detailOptions[nextCategory][0]
    setDetail(nextDetail)
    setLiberalArea(nextCategory === 'liberal' ? liberalAreaOptions[nextDetail]?.[0] ?? '' : '')
    if (!meetings.length && nextDetail !== '이러닝') setMeetings([blankMeeting()])
  }

  const changeDetail = (nextDetail: string) => {
    setDetail(nextDetail)
    if (category === 'liberal') setLiberalArea(liberalAreaOptions[nextDetail]?.[0] ?? '')
    setError('')
    if (nextDetail === '이러닝') setMeetings([])
    else if (!meetings.length) setMeetings([blankMeeting()])
  }

  const updateMeeting = (index: number, patch: Partial<CourseMeeting>) => {
    setMeetings((current) => current.map((meeting, meetingIndex) => meetingIndex === index ? { ...meeting, ...patch } : meeting))
    setError('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const savedMeetings = isTimelessCourse ? [] : meetings
    if (!isTimelessCourse && !savedMeetings.length) return setError('수업 시간을 한 개 이상 등록해 주세요.')
    if (savedMeetings.some((meeting) => !meeting.room.trim())) return setError('모든 수업의 강의실을 입력해 주세요.')
    if (savedMeetings.some((meeting) => meeting.startTime >= meeting.endTime)) return setError('종료 시간은 시작 시간보다 늦어야 합니다.')

    const selfOverlap = savedMeetings.some((meeting, index) => savedMeetings.slice(index + 1).some((other) => meetingsOverlap(meeting, other)))
    if (selfOverlap) return setError('같은 과목 안에서 수업 시간이 서로 겹칩니다.')

    const overlapping = courses
      .filter((course) => course.id !== initialCourse?.id && course.term === term)
      .find((course) => getCourseMeetings(course).some((savedMeeting) => savedMeetings.some((meeting) => meetingsOverlap(savedMeeting, meeting))))
    if (overlapping) return setError(`'${overlapping.name}' 수업과 시간이 겹칩니다.`)

    const firstMeeting = savedMeetings[0]
    onSave({
      id: initialCourse?.id ?? crypto.randomUUID(), name: name.trim(), term, category, detail,
      day: firstMeeting?.day, startTime: firstMeeting?.startTime, endTime: firstMeeting?.endTime,
      room: firstMeeting?.room.trim(), meetings: savedMeetings.map((meeting) => ({ ...meeting, room: meeting.room.trim() })),
      credits, grade: initialCourse?.grade,
      catalogId: initialCourse?.catalogId ?? catalogCourse?.id,
      subjectCode: initialCourse?.subjectCode ?? catalogCourse?.subjectCode,
      section: initialCourse?.section ?? catalogCourse?.section,
      professor: professor.trim(),
      sourceSemester: initialCourse?.sourceSemester ?? catalogSemester,
      liberalArea: category === 'liberal' ? (catalogCourse?.area || liberalArea) : undefined,
    })
  }

  return (
    <section className="schedule-modal course-form-modal" role="dialog" aria-modal="true" aria-labelledby="course-form-title">
      <header>
        {onBack ? <button className="course-form-back" type="button" onClick={onBack} aria-label="과목 목록으로 돌아가기">←</button> : <span />}
        <div><span>{isEditing ? '수업 정보 관리' : catalogCourse ? '강의 정보 자동 적용' : '직접 추가'}</span><h2 id="course-form-title">시간표 {isEditing ? '수정' : '추가'}</h2></div>
        <button type="button" onClick={onClose} aria-label="닫기">×</button>
      </header>
      {(catalogCourse || initialCourse?.catalogId) && (
        <div className="selected-catalog-course">
          <span>{catalogSemester?.replace('-', '년 ') ?? initialCourse?.sourceSemester?.replace('-', '년 ')}학기 · {catalogCourse?.classification ?? initialCourse?.detail}</span>
          <strong>{catalogCourse?.name ?? initialCourse?.name}</strong>
          <small>{[professor || '담당교수 미정', catalogCourse?.department, `${credits}학점`].filter(Boolean).join(' · ')}</small>
          <em>{isTimelessCourse ? '시간 설정 없이 시간표 하단에 표시됩니다.' : catalogCourse && !automaticMeetings.length ? '표준 시간 정보가 없어 직접 입력이 필요합니다.' : `${meetings.length}개 수업 시간이 자동 적용되었습니다.`}</em>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {!catalogCourse && <label className="schedule-form-wide"><span>과목명</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 자료구조" required /></label>}
        {!catalogCourse && <label className="schedule-form-wide"><span>담당 교수</span><input value={professor} onChange={(event) => setProfessor(event.target.value)} placeholder="예: 김건국" /></label>}
        <label className="schedule-form-wide"><span>학기</span><select value={term} onChange={(event) => setTerm(event.target.value as AcademicTerm)}>{[...academicTerms].reverse().map((item) => <option value={item} key={item}>{formatAcademicTerm(item)}</option>)}</select></label>
        {!catalogCourse && <>
          <label><span>과목 구분</span><select value={category} onChange={(event) => changeCategory(event.target.value as CourseCategory)}><option value="major">전공</option><option value="liberal">교양</option><option value="other">기타</option></select></label>
          <label><span>세부 구분</span><select value={detail} onChange={(event) => changeDetail(event.target.value)}>{detailOptions[category].map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>학점</span><select value={credits} onChange={(event) => setCredits(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((credit) => <option key={credit} value={credit}>{credit}학점</option>)}</select></label>
          {category === 'liberal' && <label className="schedule-form-wide"><span>교양 영역</span><select value={liberalArea} onChange={(event) => setLiberalArea(event.target.value)} required>{(liberalAreaOptions[detail] ?? []).map((option) => <option key={option}>{option}</option>)}</select></label>}
        </>}

        {isTimelessCourse ? (
          <div className="timeless-course-notice schedule-form-wide">
            <strong>시간 없는 온라인 강의</strong>
            <span>요일·시간·강의실을 입력하지 않고 시간표 하단에 별도로 추가합니다.</span>
          </div>
        ) : <div className="course-meeting-editor schedule-form-wide">
          <div className="course-meeting-heading"><span>수업 시간 및 강의실</span><button type="button" onClick={() => setMeetings((current) => [...current, blankMeeting()])}>+ 시간 추가</button></div>
          {meetings.map((meeting, index) => (
            <div className="course-meeting-row" key={`${index}-${meeting.day}-${meeting.startTime}`}>
              <label><span>{index + 1}회차 요일</span><select value={meeting.day} onChange={(event) => updateMeeting(index, { day: event.target.value as CourseDay })}>{(['월', '화', '수', '목', '금'] as CourseDay[]).map((weekday) => <option key={weekday}>{weekday}</option>)}</select></label>
              <label><span>시작</span><select value={meeting.startTime} onChange={(event) => updateMeeting(index, { startTime: event.target.value })}>{classTimes.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label>
              <label><span>종료</span><select value={meeting.endTime} onChange={(event) => updateMeeting(index, { endTime: event.target.value })}>{classTimes.slice(1).map((time) => <option key={time}>{time}</option>)}</select></label>
              <label className="meeting-room"><span>강의실</span><input value={meeting.room} onChange={(event) => updateMeeting(index, { room: event.target.value })} placeholder="예: 신공학관 405" required /></label>
              {meetings.length > 1 && <button className="meeting-remove" type="button" onClick={() => setMeetings((current) => current.filter((_, meetingIndex) => meetingIndex !== index))} aria-label={`${index + 1}회차 삭제`}>×</button>}
            </div>
          ))}
        </div>}

        {error && <p className="schedule-form-error" role="alert">{error}</p>}
        <div className="schedule-form-actions schedule-form-wide">
          {isEditing && onDelete && <button className="schedule-delete-button" type="button" onClick={() => { if (initialCourse && window.confirm(`'${initialCourse.name}' 수업을 삭제할까요?`)) onDelete(initialCourse.id) }}>삭제</button>}
          <button className="schedule-primary-button" type="submit">{isEditing ? '수정 내용 저장' : '자동 시간표 추가'}</button>
        </div>
      </form>
    </section>
  )
}

export default CourseScheduleForm
