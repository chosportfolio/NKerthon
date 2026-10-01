import type { CatalogManifest, CatalogPayload, CatalogSemester } from '../types/courseCatalog'

const cache = new Map<CatalogSemester, CatalogPayload>()

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error('강의 목록을 불러오지 못했습니다.')
  return response.json() as Promise<T>
}

export function loadCatalogManifest() {
  return getJson<CatalogManifest>('/course-catalog/manifest.json')
}

export async function loadCourseCatalog(semester: CatalogSemester) {
  const cached = cache.get(semester)
  if (cached) return cached
  const payload = await getJson<CatalogPayload>(`/course-catalog/${semester}.json`)
  cache.set(semester, payload)
  return payload
}
