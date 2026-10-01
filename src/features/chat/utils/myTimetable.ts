import { currentAcademicTerm } from '../../schedule/constants/academicTerms'
import { getCourseMeetings } from '../../schedule/utils/courseMeetings'
import { loadScheduleCourses } from '../../schedule/utils/scheduleStorage'
import type { TimetableCourse } from '../types/assistant'

/** 앱 시간표에 등록한 이번 학기 수업 — '오늘 수업 어디야?' 같은 질문에 쓰도록 챗봇에 같이 보낸다 */
export function getMyTimetable(userId: number): TimetableCourse[] {
  return loadScheduleCourses(userId)
    .filter((course) => course.term === currentAcademicTerm && !course.id.startsWith('sample-'))
    .slice(0, 30)
    .map((course) => ({
      name: course.name,
      credits: course.credits,
      professor: course.professor ?? '',
      meetings: getCourseMeetings(course).map(({ day, startTime, endTime, room }) => ({ day, startTime, endTime, room })),
    }))
}
