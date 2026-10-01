import type { AcademicTerm } from '../types/schedule'

const currentYear = new Date().getFullYear()

export const academicTerms: AcademicTerm[] = Array.from(
  { length: currentYear - 2017 + 1 },
  (_, index) => 2017 + index,
).flatMap((year) => [`${year}-1`, `${year}-2`] as AcademicTerm[])

export const catalogSemesters = academicTerms

export const currentAcademicTerm: AcademicTerm = `${currentYear}-${new Date().getMonth() < 6 ? 1 : 2}`

export function formatAcademicTerm(term: AcademicTerm) {
  const [year, semester] = term.split('-')
  return `${year}년 ${semester}학기`
}

