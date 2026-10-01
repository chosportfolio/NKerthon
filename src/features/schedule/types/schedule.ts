export type CourseCategory = 'major' | 'liberal' | 'other'
export type CourseDay = '월' | '화' | '수' | '목' | '금' | '토'
export type CourseGrade = 'A+' | 'A0' | 'B+' | 'B0' | 'C+' | 'C0' | 'D+' | 'D0' | 'F' | 'P'
export type AcademicTerm = `${number}-${1 | 2}`

export type CourseMeeting = {
  day: CourseDay
  startTime: string
  endTime: string
  room: string
}

export type ScheduleCourse = {
  id: string
  name: string
  term: AcademicTerm
  category: CourseCategory
  detail: string
  day?: CourseDay
  startTime?: string
  endTime?: string
  room?: string
  credits: number
  grade?: CourseGrade
  meetings?: CourseMeeting[]
  catalogId?: string
  subjectCode?: string
  section?: string
  professor?: string
  sourceSemester?: string
  liberalArea?: string
}
