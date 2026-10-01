import { useEffect, useMemo, useState } from 'react'
import {
  admissionYears,
  getGraduationRequirement,
  getLiberalCurriculumAreas,
  isRequiredCourseCompleted,
} from '../constants/graduationRequirements'
import type { ScheduleCourse } from '../types/schedule'
import { loadRequiredMajorCourses } from '../services/requiredMajorCourses'
import type { RequiredMajorCourse } from '../services/requiredMajorCourses'
import { criterionAreaKeys, inferLiberalArea } from '../constants/liberalAreas'

type GraduationProgressProps = {
  courses: ScheduleCourse[]
  department: string
  admissionYear: number
  onAdmissionYearChange: (year: number) => void
}

type ProgressItemProps = {
  label: string
  current: number
  target: number
  featured?: boolean
}

function ProgressItem({ label, current, target, featured = false }: ProgressItemProps) {
  const cappedCurrent = Math.min(current, target)
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 100
  const remaining = Math.max(0, target - current)

  return (
    <article className={`graduation-progress-item${featured ? ' is-featured' : ''}`}>
      <div className="graduation-progress-heading">
        <div><strong>{label}</strong><span>{remaining ? `${remaining}학점 남음` : '충족'}</span></div>
        <b>{cappedCurrent}<small> / {target}</small></b>
      </div>
      <div className="graduation-progress-track" aria-label={`${label} ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </article>
  )
}

function GraduationProgress({
  courses,
  department,
  admissionYear,
  onAdmissionYearChange,
}: GraduationProgressProps) {
  const requiredMajorKey = `${department}:${admissionYear}`
  const [requiredMajorResult, setRequiredMajorResult] = useState<{ key: string; courses: RequiredMajorCourse[] }>({ key: '', courses: [] })
  const requiredMajorLoading = requiredMajorResult.key !== requiredMajorKey
  const requiredMajorCourses = requiredMajorLoading ? [] : requiredMajorResult.courses
  const requirement = getGraduationRequirement(department, admissionYear)
  const earnedCourses = useMemo(
    () => courses.filter((course) => course.grade && course.grade !== 'F'),
    [courses],
  )
  const sumCredits = (predicate: (course: ScheduleCourse) => boolean) => earnedCourses
    .filter(predicate)
    .reduce((sum, course) => sum + course.credits, 0)
  const totalCredits = sumCredits(() => true)
  const majorRequired = sumCredits((course) => course.category === 'major' && course.detail === '전필')
  const majorElective = sumCredits((course) => course.category === 'major' && course.detail === '전선')
  const majorTotal = majorRequired + majorElective
  const liberalBasic = sumCredits((course) => course.category === 'liberal' && course.detail === '기초')
  const liberalAdvanced = sumCredits((course) => course.category === 'liberal' && course.detail === '심화')
  const liberalCulture = sumCredits((course) => course.category === 'liberal' && course.detail === '소양')
  const liberalTotal = liberalBasic + liberalAdvanced + liberalCulture
  const liberalCurriculumAreas = getLiberalCurriculumAreas(admissionYear, department)
  const earnedNames = earnedCourses.map((course) => course.name)
  const completedRequiredMajor = requiredMajorCourses.filter((course) => isRequiredCourseCompleted(earnedNames, {
    label: course.name,
    alternatives: [course.name],
  })).length

  useEffect(() => {
    let active = true
    loadRequiredMajorCourses(department, admissionYear)
      .then((courses) => {
        if (active) setRequiredMajorResult({ key: requiredMajorKey, courses })
      })
      .catch(() => {
        if (active) setRequiredMajorResult({ key: requiredMajorKey, courses: [] })
      })
    return () => { active = false }
  }, [admissionYear, department, requiredMajorKey])

  if (!requirement) {
    return (
      <div className="graduation-view">
        <div className="graduation-profile-row">
          <div><span>적용 학과</span><strong>{department}</strong></div>
          <label><span>입학연도</span><select value={admissionYear} onChange={(event) => onAdmissionYearChange(Number(event.target.value))}>{admissionYears.map((year) => <option key={year}>{year}</option>)}</select></label>
        </div>
        <div className="graduation-empty">
          <strong>이 학과의 {admissionYear}학년도 기준을 찾지 못했어요.</strong>
          <p>입학연도를 바꿔 보거나 학과 표기를 확인해 주세요.</p>
        </div>
      </div>
    )
  }

  const creditReady = totalCredits >= requirement.graduation
    && majorTotal >= requirement.majorTotal
    && majorRequired >= requirement.majorRequired
    && majorElective >= requirement.majorElective
    && liberalTotal >= requirement.liberal
    && liberalBasic >= requirement.liberalBasic
    && liberalAdvanced >= requirement.liberalAdvanced
    && liberalCulture >= requirement.liberalCulture
  const allReady = creditReady
  const liberalAreaCredits = {
    basic: liberalBasic,
    advanced: liberalAdvanced,
    culture: liberalCulture,
  }
  const liberalAreaTargets = {
    basic: requirement.liberalBasic,
    advanced: requirement.liberalAdvanced,
    culture: requirement.liberalCulture,
  }

  return (
    <div className="graduation-view">
      <div className="graduation-profile-row">
        <div><span>적용 학과</span><strong>{requirement.department}</strong></div>
        <label>
          <span>입학연도</span>
          <select value={admissionYear} onChange={(event) => onAdmissionYearChange(Number(event.target.value))}>
            {admissionYears.map((year) => <option key={year}>{year}</option>)}
          </select>
        </label>
      </div>

      <section className={`graduation-status-card${allReady ? ' is-ready' : ''}`}>
        <span>{allReady ? '졸업 학점 기준 충족' : '졸업까지 필요한 학점을 확인하세요'}</span>
        <div><strong>{Math.min(totalCredits, requirement.graduation)}</strong><small> / {requirement.graduation}학점</small></div>
        <div className="graduation-status-track"><span style={{ width: `${Math.min(100, Math.round((totalCredits / requirement.graduation) * 100))}%` }} /></div>
      </section>

      <div className="graduation-progress-list">
        <ProgressItem label="전체 취득 학점" current={totalCredits} target={requirement.graduation} featured />
        <ProgressItem label="전공 전체" current={majorTotal} target={requirement.majorTotal} />
        <ProgressItem label="전공필수" current={majorRequired} target={requirement.majorRequired} />
        <ProgressItem label="전공선택" current={majorElective} target={requirement.majorElective} />
        <ProgressItem label="교양 전체" current={liberalTotal} target={requirement.liberal} />
        <ProgressItem label="기초교양" current={liberalBasic} target={requirement.liberalBasic} />
        <ProgressItem label="심화교양" current={liberalAdvanced} target={requirement.liberalAdvanced} />
        <ProgressItem label="소양·기타 교양" current={liberalCulture} target={requirement.liberalCulture} />
      </div>

      <section className="required-course-section">
        <div className="required-course-title">
          <div><strong>전공필수 과목</strong><span>{admissionYear}학번 · 실제 개설자료 기준</span></div>
          <b>{requiredMajorLoading ? '확인 중' : `${completedRequiredMajor} / ${requiredMajorCourses.length}`}</b>
        </div>
        {requiredMajorLoading ? (
          <p className="required-course-empty">입학연도와 학과에 맞는 전공필수를 불러오고 있어요.</p>
        ) : requiredMajorCourses.length ? (
          <div className="required-course-grid">
            {requiredMajorCourses.map((course) => {
              const completed = isRequiredCourseCompleted(earnedNames, { label: course.name, alternatives: [course.name] })
              return <span className={completed ? 'is-completed' : ''} key={course.id}><i>{completed ? '✓' : '–'}</i>{course.name}<small>{course.gradeYear}학년</small></span>
            })}
          </div>
        ) : (
          <p className="required-course-empty">해당 입학연도 이후 개설자료에서 전공필수 과목을 찾지 못했어요.</p>
        )}
      </section>

      <section className="liberal-curriculum-section">
        <div className="required-course-title">
          <div><strong>교양 영역별 이수기준</strong><span>{admissionYear}학년도 요람 기준</span></div>
          <b>{liberalTotal} / {requirement.liberal}</b>
        </div>
        <div className="liberal-curriculum-grid">
          {liberalCurriculumAreas.map((area) => {
            const current = liberalAreaCredits[area.key]
            const target = liberalAreaTargets[area.key]
            const completed = current >= target
            return (
              <article className={completed ? 'is-completed' : ''} key={area.key}>
                <div className="liberal-area-heading">
                  <span><i>{completed ? '✓' : area.label.slice(0, 1)}</i><strong>{area.label}</strong></span>
                  <b>{current}<small> / {target}학점</small></b>
                </div>
                <div className="liberal-area-track"><span style={{ width: `${target ? Math.min(100, Math.round((current / target) * 100)) : 100}%` }} /></div>
                <p>{area.description}</p>
                <div className="liberal-area-criteria">
                  {area.criteria.map((criterion) => {
                    const criterionEarned = earnedCourses
                      .filter((course) => course.category === 'liberal' && criterionAreaKeys(criterion.label).includes(inferLiberalArea(course)))
                      .reduce((sum, course) => sum + course.credits, 0)
                    const criterionTarget = Number(criterion.credits.match(/\d+/)?.[0] ?? 0)
                    const criterionCompleted = criterionTarget ? criterionEarned >= criterionTarget : criterionEarned > 0
                    return (
                    <span className={criterionCompleted ? 'is-completed' : ''} key={criterion.label}>
                      <strong>{criterion.label}</strong>
                      <b>{criterion.credits === '선택 영역' ? `${criterionEarned}학점` : `${criterionEarned} / ${criterion.credits}`}</b>
                      {criterion.note && <small>{criterion.note}</small>}
                      {criterion.requiredGroups?.map((group) => {
                        const courseCompleted = isRequiredCourseCompleted(earnedNames, group)
                        return <em className={courseCompleted ? 'is-completed' : ''} key={group.label}><i>{courseCompleted ? '✓' : '–'}</i>{group.label}</em>
                      })}
                    </span>
                    )
                  })}
                </div>
                <div className="liberal-area-tags">
                  {area.highlights.map((highlight) => <span className="is-rule" key={highlight}>{highlight}</span>)}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <p className="graduation-notice">입력한 성적 중 F를 제외한 과목만 반영됩니다. 최종 졸업 심사는 학과와 학사지원팀에서 확인해 주세요.</p>
    </div>
  )
}

export default GraduationProgress
