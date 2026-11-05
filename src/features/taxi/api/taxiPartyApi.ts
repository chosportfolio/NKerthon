import { getSavedAuthToken } from '../../auth/api/authApi'
import { apiUrl } from '../../../shared/api/url'
import type { CreateTaxiPartyData, TaxiParty, TaxiPartyMessage } from '../types/taxiParty'

async function request(url: string, options?: RequestInit) {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')

  let response: Response
  try {
    response = await fetch(apiUrl(url), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    })
  } catch {
    throw new Error('택시팟 서버에 연결할 수 없습니다.')
  }

  const data = await response.json() as { parties?: TaxiParty[]; message?: string }
  if (!response.ok) throw new Error(data.message ?? '요청을 처리하지 못했습니다.')
  return data.parties ?? []
}

export function getTaxiParties() {
  return request('/api/taxi-parties')
}

export function createTaxiParty(data: CreateTaxiPartyData) {
  return request('/api/taxi-parties', { method: 'POST', body: JSON.stringify(data) })
}

export function joinTaxiParty(partyId: number) {
  return request(`/api/taxi-parties/${partyId}`, { method: 'POST' })
}

export function leaveTaxiParty(partyId: number) {
  return request(`/api/taxi-parties/${partyId}`, { method: 'DELETE' })
}

export function changeTaxiPartyStatus(partyId: number, status: 'open' | 'closed') {
  return request(`/api/taxi-parties/${partyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getTaxiPartyMessages(partyId: number, signal?: AbortSignal) {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')
  const response = await fetch(apiUrl(`/api/taxi-parties/${partyId}/messages`), {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  const data = await response.json() as { messages?: TaxiPartyMessage[]; message?: string }
  if (!response.ok) throw new Error(data.message ?? '채팅을 불러오지 못했습니다.')
  return data.messages ?? []
}

export async function sendTaxiPartyMessage(partyId: number, message: string) {
  const token = getSavedAuthToken()
  if (!token) throw new Error('로그인이 필요합니다.')
  const response = await fetch(apiUrl(`/api/taxi-parties/${partyId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  })
  const data = await response.json() as { message?: TaxiPartyMessage | string }
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : '메시지를 보내지 못했습니다.')
  return data.message as TaxiPartyMessage
}

