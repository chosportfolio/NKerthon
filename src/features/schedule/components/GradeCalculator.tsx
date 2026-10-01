import { useState } from 'react'
import type { FormEvent } from 'react'
import { academicTerms, formatAcademicTerm } from '../constants/academicTerms'
import { inferAdmissionYear } from '../constants/graduationRequirements'
import type {
  AcademicTerm,
  CourseCategory,
  CourseGrade,
  ScheduleCourse,
} from '../types/schedule'
import GraduationProgress from './GraduationProgress'
import { liberalAreaOptions } from '../constants/liberalAreas'

type GradeCalculatorProps = {
  courses: ScheduleCourse[]
  initialTerm: AcademicTerm
  department: string
  studentNumber: string
  onClose: () => void
  onAdd: (course: ScheduleCourse) => void
  onGradeChange: (courseId: string, grade: CourseGrade | undefined) => void
  onDelete: (courseId: string) => void
}

const gradePoints: Record<CourseGrade, number | null> = {
  'A+': 4.5, A0: 4, 'B+': 3.5, B0: 3, 'C+': 2.5,
  C0: 2, 'D+': 1.5, D0: 1, F: 0, P: null,
}
const grades = Object.keys(gradePoints) as CourseGrade[]
const detailOptions = {
  major: ['전필', '전선'],
  liberal: ['기초', '심화', '소양'],
  other: ['자선', '교직', '이러닝', '일선'],
} satisfies Record<CourseCategory, string[]>

function calculateGpa(courses: ScheduleCourse[]) {
  const gradedCourses = courses.filter(
    (course): course is ScheduleCourse & { grade: CourseGrade } =>
      Boolean(course.grade) && gradePoints[course.grade as CourseGrade] !== null,
  )
  const credits = gradedCourses.reduce((sum, course) => sum + course.credits, 0)
  const points = gradedCourses.reduce(
    (sum, course) => sum + (gradePoints[course.grade] ?? 0) * course.credits,
    0,
  )
  return credits ? (points / credits).toFixed(2) : '0.00'
}

function GradeCalculator({
  courses,
  initialTerm,
  department,
  studentNumber,
  onClose,
  onAdd,
  onGradeChange,
  onDelete,
}: GradeCalculatorProps) {
  const [view, setView] = useState<'grades' | 'graduation'>('grades')
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm>(initialTerm)
  const [admissionYear, setAdmissionYear] = useState(() => inferAdmissionYear(studentNumber))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CourseCategory>('major')
  const [detail, setDetail] = useState('전필')
  const [liberalArea, setLiberalArea] = useState('')
  const [credits, setCredits] = useState(3)
  const [grade, setGrade] = useState<CourseGrade>('A0')

  const termCourses = courses.filter((course) => course.term === selectedTerm)
  const majorCourses = courses.filter((course) => course.category === 'major')
  const earnedCredits = courses
    .filter((course) => course.grade && course.grade !== 'F')
    .reduce((sum, course) => sum + course.credits, 0)
  const termCredits = termCourses
    .filter((course) => course.grade && course.grade !== 'F')
    .reduce((sum, course) => sum + course.credits, 0)

  const changeCategory = (nextCategory: CourseCategory) => {
    setCategory(nextCategory)
    setDetail(detailOptions[nextCategory][0])
    setLiberalArea(nextCategory === 'liberal' ? liberalAreaOptions.기초[0] : '')
  }

  const changeDetail = (nextDetail: string) => {
    setDetail(nextDetail)
    if (category === 'liberal') setLiberalArea(liberalAreaOptions[nextDetail]?.[0] ?? '')
  }

  const addGradeCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      term: selectedTerm,
      category,
      detail,
      credits,
      grade,
      liberalArea: category === 'liberal' ? liberalArea : undefined,
    })
    setName('')
    setAdding(false)
  }

  return (
    <div className="schedule-modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="schedule-modal grade-calculator-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grade-calculator-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><span>{department}</span><h2 id="grade-calculator-title">학사 계산기</h2></div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </header>

        <nav className="calculator-view-tabs" aria-label="계산기 화면 선택">
          <button className={view === 'grades' ? 'is-active' : ''} type="button" onClick={() => setView('grades')}>학점 계산</button>
          <button className={view === 'graduation' ? 'is-active' : ''} type="button" onClick={() => setView('graduation')}>졸업 이수 현황</button>
        </nav>

        {view === 'grades' ? (
          <>
            <div className="grade-summary">
              <div><span>전체 평점</span><strong>{calculateGpa(courses)}</strong><small>/ 4.5</small></div>
              <div><span>전공 평점</span><strong>{calculateGpa(majorCourses)}</strong><small>/ 4.5</small></div>
              <div><span>취득 학점</span><strong>{earnedCredits}</strong><small>학점</small></div>
            </div>

            <nav className="grade-term-tabs" aria-label="학기 선택">
              {[...academicTerms].reverse().map((term) => (
                <button
                  className={term === selectedTerm ? 'is-active' : ''}
                  type="button"
                  onClick={() => {
                    setSelectedTerm(term)
                    setAdding(false)
                  }}
                  key={term}
                >
                  {formatAcademicTerm(term)}
                </button>
              ))}
            </nav>

            <div className="term-grade-heading">
              <div>
                <h3>{formatAcademicTerm(selectedTerm)}</h3>
                <span>평점 <strong>{calculateGpa(termCourses)}</strong> · 취득 {termCredits}학점</span>
              </div>
              <button type="button" onClick={() => setAdding((current) => !current)}>
                {adding ? '취소' : '+ 과목 추가'}
              </button>
            </div>

            {adding && (
              <form className="grade-add-form" onSubmit={addGradeCourse}>
                <label className="grade-add-wide">
                  <span>과목명</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="과목명을 입력하세요" required />
                </label>
                <label>
                  <span>과목 구분</span>
                  <select value={category} onChange={(event) => changeCategory(event.target.value as CourseCategory)}>
                    <option value="major">전공</option>
                    <option value="liberal">교양</option>
                    <option value="other">기타</option>
                  </select>
                </label>
                <label>
                  <span>세부 구분</span>
                  <select value={detail} onChange={(event) => changeDetail(event.target.value)}>
                    {detailOptions[category].map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                {category === 'liberal' && <label><span>교양 영역</span><select value={liberalArea} onChange={(event) => setLiberalArea(event.target.value)}>{(liberalAreaOptions[detail] ?? []).map((option) => <option key={option}>{option}</option>)}</select></label>}
                <label>
                  <span>이수 학점</span>
                  <select value={credits} onChange={(event) => setCredits(Number(event.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((credit) => <option value={credit} key={credit}>{credit}학점</option>)}
                  </select>
                </label>
                <label>
                  <span>성적</span>
                  <select value={grade} onChange={(event) => setGrade(event.target.value as CourseGrade)}>
                    {grades.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <button className="grade-add-submit grade-add-wide" type="submit">이 학기에 추가</button>
              </form>
            )}

            <div className="grade-course-list">
              <div className="grade-list-heading"><strong>과목별 성적</strong><span>{termCourses.length}과목</span></div>
              {termCourses.length === 0 ? (
                <p className="empty-grade-list">이 학기에 등록된 과목이 없습니다.</p>
              ) : termCourses.map((course) => (
                <article key={course.id}>
                  <div>
                    <strong>{course.name}</strong>
                    <small>{course.category === 'major' ? '전공' : '교양'} · {course.detail}{course.liberalArea ? ` · ${course.liberalArea}` : ''} · {course.credits}학점</small>
                  </div>
                  <select
                    value={course.grade ?? ''}
                    aria-label={`${course.name} 성적`}
                    onChange={(event) => onGradeChange(
                      course.id,
                      event.target.value ? event.target.value as CourseGrade : undefined,
                    )}
                  >
                    <option value="">미입력</option>
                    {grades.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <button type="button" onClick={() => onDelete(course.id)} aria-label={`${course.name} 삭제`}>×</button>
                </article>
              ))}
            </div>
          </>
        ) : (
          <GraduationProgress
            courses={courses}
            department={department}
            admissionYear={admissionYear}
            onAdmissionYearChange={setAdmissionYear}
          />
        )}
      </section>
    </div>
  )
}

export default GradeCalculator
