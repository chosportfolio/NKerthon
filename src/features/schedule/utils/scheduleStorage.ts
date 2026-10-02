import { currentAcademicTerm } from '../constants/academicTerms'
import type { AcademicTerm, ScheduleCourse } from '../types/schedule'

type StoredCourse = Omit<ScheduleCourse, 'term'> & { term?: string }

function isAcademicTerm(value: unknown): value is AcademicTerm {
  return typeof value === 'string' && /^20\d{2}-[12]$/.test(value)
}

export const getScheduleStorageKey = (userId: number) => `campus-schedule-${userId}`

export function loadScheduleCourses(userId: number) {
  const savedCourses = localStorage.getItem(getScheduleStorageKey(userId))
  if (!savedCourses) return []

  try {
    const parsedCourses = JSON.parse(savedCourses) as StoredCourse[]
    const legacyMapping = JSON.parse(localStorage.getItem(`campus-semester-mapping-${userId}`) ?? '{}') as Record<string, string>

    return parsedCourses.map((course): ScheduleCourse => {
      const mappedTerm = course.term ? legacyMapping[course.term] : undefined
      const term = isAcademicTerm(course.term)
        ? course.term
        : isAcademicTerm(course.sourceSemester)
          ? course.sourceSemester
          : isAcademicTerm(mappedTerm)
            ? mappedTerm
            : currentAcademicTerm
      return { ...course, term }
    })
  } catch {
    return []
  }
}
