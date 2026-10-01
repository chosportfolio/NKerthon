import { loadCatalogManifest, loadCourseCatalog } from './courseCatalog'
import type { CatalogCourse, CatalogSemester } from '../types/courseCatalog'

export type RequiredMajorCourse = {
  id: string
  name: string
  gradeYear: number
  offeredTerms: CatalogSemester[]
}

const normalize = (value: string) => value.replace(/[\s·()]/g, '').toLowerCase()
const normalizeDepartment = (value: string) => normalize(value).replace(/(학과|전공)$/u, '')

function matchesDepartment(course: CatalogCourse, department: string) {
  return normalizeDepartment(course.department) === normalizeDepartment(department)
}

export async function loadRequiredMajorCourses(department: string, admissionYear: number) {
  const manifest = await loadCatalogManifest()
  const availableYears = [...new Set(manifest.semesters.map(({ key }) => Number(key.split('-')[0])))]
    .sort((first, second) => Math.abs(first - admissionYear) - Math.abs(second - admissionYear) || second - first)

  for (const catalogYear of availableYears) {
    const semesters = manifest.semesters
      .map(({ key }) => key)
      .filter((semester) => Number(semester.split('-')[0]) === catalogYear)
    const payloads = await Promise.all(semesters.map((semester) => loadCourseCatalog(semester)))
    const required = new Map<string, RequiredMajorCourse>()

    payloads.forEach((payload) => {
      payload.courses.forEach((course) => {
        const catalogGrade = Number(course.gradeYear.match(/[1-4]/)?.[0])
        if (normalize(course.classification) !== '전필') return
        if (!matchesDepartment(course, department)) return

        // 같은 과목의 여러 분반은 학수번호 기준으로 하나만 표시한다.
        const id = course.subjectCode.trim() || normalize(course.name)
        const previous = required.get(id)
        if (previous) {
          if (!previous.offeredTerms.includes(payload.semester)) previous.offeredTerms.push(payload.semester)
          return
        }
        required.set(id, {
          id,
          name: course.name.trim(),
          gradeYear: catalogGrade || 0,
          offeredTerms: [payload.semester],
        })
      })
    })

    if (required.size) {
      return [...required.values()].sort((first, second) =>
        first.gradeYear - second.gradeYear
          || first.offeredTerms[0].localeCompare(second.offeredTerms[0])
          || first.name.localeCompare(second.name, 'ko'),
      )
    }
  }

  return []
}
