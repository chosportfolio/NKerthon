import { currentAcademicTerm } from './academicTerms'
import type { ScheduleCourse } from '../types/schedule'

export const defaultScheduleCourses: ScheduleCourse[] = [
  { id: 'sample-os', name: '운영체제', term: currentAcademicTerm, category: 'major', detail: '전필', day: '월', startTime: '09:00', endTime: '10:30', room: '신공학관 302', credits: 3, grade: 'A0' },
  { id: 'sample-data', name: '자료구조', term: currentAcademicTerm, category: 'major', detail: '전필', day: '화', startTime: '10:30', endTime: '12:00', room: '신공학관 405', credits: 3, grade: 'B+' },
  { id: 'sample-stat', name: '확률통계', term: currentAcademicTerm, category: 'liberal', detail: '기초', day: '수', startTime: '15:00', endTime: '16:30', room: '인문관 201', credits: 3, grade: 'A+' },
]
