import type { CatalogCourse } from '../types/courseCatalog'
import type { CourseDay, CourseMeeting, ScheduleCourse } from '../types/schedule'

const meetingPattern = /([월화수목금])\s*(\d{1,2}:?\d{2})\s*-\s*(\d{1,2}:?\d{2})(?:\s*\(([^)]*)\))?/g

function normalizeTime(value: string) {
  const digits = value.replace(':', '').padStart(4, '0')
  const hour = Number(digits.slice(0, 2))
  const minute = Number(digits.slice(2))
  if (hour > 23 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseCatalogMeetings(course: Pick<CatalogCourse, 'sourceSchedule'>): CourseMeeting[] {
  const meetings: CourseMeeting[] = []
  for (const match of course.sourceSchedule.matchAll(meetingPattern)) {
    const startTime = normalizeTime(match[2])
    const endTime = normalizeTime(match[3])
    if (!startTime || !endTime || startTime >= endTime) continue
    const meeting = {
      day: match[1] as CourseDay,
      startTime,
      endTime,
      room: (match[4] ?? '강의실 미정').trim(),
    }
    if (!meetings.some((item) => item.day === meeting.day && item.startTime === meeting.startTime && item.endTime === meeting.endTime && item.room === meeting.room)) {
      meetings.push(meeting)
    }
  }
  return meetings
}

export function getCourseMeetings(course: ScheduleCourse): CourseMeeting[] {
  if (course.meetings?.length) return course.meetings
  if (course.day && course.startTime && course.endTime) {
    return [{ day: course.day, startTime: course.startTime, endTime: course.endTime, room: course.room || '강의실 미정' }]
  }
  return []
}

export function meetingsOverlap(first: CourseMeeting, second: CourseMeeting) {
  return first.day === second.day && first.startTime < second.endTime && first.endTime > second.startTime
}
