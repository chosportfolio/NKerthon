import type { SignupData, User } from '../types/auth'
import { apiUrl } from '../../../shared/api/url'

const persistentTokenKey = 'campus-auth-token'
const sessionTokenKey = 'campus-session-token'

type LoginResponse = {
  token: string
  user: User
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(apiUrl(url), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
  } catch {
    throw new Error('로그인 서버에 연결할 수 없습니다. npm run dev 실행 상태를 확인해 주세요.')
  }
  const data = await response.json() as T & { message?: string }

  if (!response.ok) {
    throw new Error(data.message ?? '요청을 처리하지 못했습니다.')
  }

  return data
}

export async function login(loginId: string, password: string) {
  return request<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  })
}

export async function signup(data: SignupData) {
  return request<{ message: string }>('/api/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCurrentUser(token: string) {
  return request<{ user: User }>('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateProfileImage(profileImage: string) {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  return request<{ user: User }>('/api/me/profile-image', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profileImage }),
  })
}

export async function logout() {
  const token = getSavedAuthToken()
  if (!token) return

  await request<{ message: string }>('/api/logout', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function saveAuthToken(token: string, persistent: boolean) {
  localStorage.removeItem(persistentTokenKey)
  sessionStorage.removeItem(sessionTokenKey)

  if (persistent) {
    localStorage.setItem(persistentTokenKey, token)
  } else {
    sessionStorage.setItem(sessionTokenKey, token)
  }
}

export function getSavedAuthToken() {
  return localStorage.getItem(persistentTokenKey) ?? sessionStorage.getItem(sessionTokenKey)
}

export function clearAuthToken() {
  localStorage.removeItem(persistentTokenKey)
  sessionStorage.removeItem(sessionTokenKey)
}
