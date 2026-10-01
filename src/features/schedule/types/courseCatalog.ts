export type CatalogSemester = `${number}-${1 | 2}`

export type CatalogCourse = {
  id: string
  gradeYear: string
  subjectCode: string
  classification: string
  section: string
  name: string
  credits: number
  target: string
  college: string
  department: string
  sourceSchedule: string
  professor: string
  area: string
  isElearning: boolean
}

export type CatalogPayload = {
  semester: CatalogSemester
  count: number
  courses: CatalogCourse[]
}

export type CatalogManifest = {
  semesters: Array<{ key: CatalogSemester; count: number }>
}
