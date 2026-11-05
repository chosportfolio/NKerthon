import { getSavedAuthToken } from '../../auth/api/authApi'
import { apiUrl } from '../../../shared/api/url'
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

    return parsedCourses
      .filter((course) => !course.id.startsWith('sample-'))
      .map((course): ScheduleCourse => {
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

// ---------------------------------------------------------------- 서버 동기화
// 시간표는 계정별로 서버에 저장하고, 브라우저(localStorage)는 빠르게 보여주기 위한 사본으로만 쓴다.
// 서버 내용을 받기 전에는 저장하지 않는다 — 빈 시간표가 다른 PC에서 저장한 시간표를 덮어쓰지 않도록.
export const SCHEDULE_SYNCED_EVENT = 'campus-schedule-synced'

type SyncState = 'pending' | 'synced' | 'offline'
const syncState = new Map<number, SyncState>()
const lastSaved = new Map<number, string>()          // 서버에 마지막으로 저장된 내용 (같은 내용은 다시 안 보냄)
const saveTimers = new Map<number, number>()

async function scheduleRequest<T>(method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')
  const response = await fetch(apiUrl('/api/schedule'), {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error('시간표를 서버와 맞추지 못했어요.')
  return response.json() as Promise<T>
}

/** 로그인 직후 한 번: 서버 시간표를 받아 브라우저 사본을 맞춘다.
 *  서버가 비어 있고 이 브라우저에 예전에 저장한 시간표가 있으면, 그걸 서버로 올린다 (PC1 → 서버 → PC2). */
export async function syncScheduleFromServer(userId: number) {
  const key = getScheduleStorageKey(userId)
  const hadLocal = localStorage.getItem(key) !== null
  syncState.set(userId, 'pending')
  try {
    const { courses } = await scheduleRequest<{ courses: StoredCourse[] | null }>('GET')
    if (Array.isArray(courses)) {
      const json = JSON.stringify(courses)
      localStorage.setItem(key, json)
      lastSaved.set(userId, json)
    } else if (hadLocal) {
      const local = loadScheduleCourses(userId)
      await scheduleRequest('PUT', { courses: local })
      lastSaved.set(userId, JSON.stringify(local))
    } else {
      lastSaved.set(userId, '[]')
    }
    syncState.set(userId, 'synced')
  } catch {
    syncState.set(userId, 'offline')                  // 서버에 못 닿으면 이 브라우저에만 저장 (다음 로그인 때 다시 맞춤)
  }
  window.dispatchEvent(new CustomEvent(SCHEDULE_SYNCED_EVENT, { detail: userId }))
}

export function isScheduleReady(userId: number) {
  const state = syncState.get(userId)
  return state === 'synced' || state === 'offline'
}

/** 시간표가 바뀔 때마다: 브라우저 사본을 고치고, 서버에는 잠깐 모았다가(0.6초) 저장 */
export function saveScheduleCourses(userId: number, courses: ScheduleCourse[]) {
  if (!isScheduleReady(userId)) return
  const json = JSON.stringify(courses)
  localStorage.setItem(getScheduleStorageKey(userId), json)
  if (syncState.get(userId) !== 'synced' || lastSaved.get(userId) === json) return
  window.clearTimeout(saveTimers.get(userId))
  saveTimers.set(userId, window.setTimeout(() => {
    scheduleRequest('PUT', { courses })
      .then(() => lastSaved.set(userId, json))
      .catch(() => undefined)                         // 실패하면 다음 변경 때 다시 보냄
  }, 600))
}
