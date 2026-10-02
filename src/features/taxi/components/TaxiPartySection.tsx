import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  changeTaxiPartyStatus,
  createTaxiParty,
  getTaxiParties,
  joinTaxiParty,
  leaveTaxiParty,
} from '../api/taxiPartyApi'
import type { CreateTaxiPartyData, TaxiParty } from '../types/taxiParty'
import TaxiPartyChat from './TaxiPartyChat'

type TaxiPartySectionProps = {
  onBack: () => void
}

type Filter = 'all' | 'mine'

const popularPlaces = ['건국대 글로컬캠퍼스 정문', '충주역', '충주공용버스터미널', '충주 시내']

function defaultDepartureTime() {
  const date = new Date(Date.now() + 60 * 60_000)
  date.setMinutes(Math.ceil(date.getMinutes() / 10) * 10, 0, 0)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

function createInitialForm(): CreateTaxiPartyData {
  return {
    departure: '건국대 글로컬캠퍼스 정문',
    destination: '',
    departureAt: defaultDepartureTime(),
    capacity: 4,
    note: '',
  }
}

function formatDepartureTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const dayLabel = date.toDateString() === today.toDateString()
    ? '오늘'
    : date.toDateString() === tomorrow.toDateString() ? '내일' : `${date.getMonth() + 1}.${date.getDate()}`
  return `${dayLabel} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

function TaxiPartySection({ onBack }: TaxiPartySectionProps) {
  const [parties, setParties] = useState<TaxiParty[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [activeChatParty, setActiveChatParty] = useState<TaxiParty | null>(null)
  const [form, setForm] = useState(createInitialForm)
  const [customDeparture, setCustomDeparture] = useState(false)
  const [customDestination, setCustomDestination] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const visibleParties = useMemo(
    () => filter === 'mine' ? parties.filter((party) => party.isMember) : parties,
    [filter, parties],
  )

  useEffect(() => {
    getTaxiParties()
      .then(setParties)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  const runPartyAction = async (partyId: number, action: () => Promise<TaxiParty[]>) => {
    setPendingId(partyId)
    setError('')
    try {
      setParties(await action())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '요청을 처리하지 못했습니다.')
    } finally {
      setPendingId(null)
    }
  }

  const confirmDeleteParty = (party: TaxiParty) => {
    const confirmed = window.confirm(
      `${party.departure} → ${party.destination} 택시팟을 삭제하시겠습니까?\n삭제한 팟과 채팅 기록은 복구할 수 없습니다.`,
    )
    if (!confirmed) return
    void runPartyAction(party.id, () => leaveTaxiParty(party.id))
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPendingId(0)
    setError('')
    try {
      const departureAt = new Date(form.departureAt).toISOString()
      setParties(await createTaxiParty({ ...form, departureAt }))
      setForm(createInitialForm())
      setCustomDeparture(false)
      setCustomDestination(false)
      setCreating(false)
      setFilter('mine')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '택시팟을 만들지 못했습니다.')
    } finally {
      setPendingId(null)
    }
  }

  if (activeChatParty) {
    return <TaxiPartyChat party={activeChatParty} onBack={() => setActiveChatParty(null)} />
  }

  if (creating) {
    return (
      <div className="taxi-section">
        <header className="taxi-page-header">
          <button type="button" onClick={() => setCreating(false)} aria-label="목록으로 돌아가기">←</button>
          <div><span>새로운 동행</span><h1>택시팟 만들기</h1></div>
        </header>
        <form className="taxi-create-form" onSubmit={handleCreate}>
          <div className="taxi-form-guide"><strong>함께 이동할 경로를 알려주세요</strong><span>방장을 포함한 전체 인원을 선택합니다.</span></div>
          <label>
            출발지
            <select
              value={customDeparture ? 'custom' : form.departure}
              onChange={(event) => {
                const custom = event.target.value === 'custom'
                setCustomDeparture(custom)
                setForm({ ...form, departure: custom ? '' : event.target.value })
              }}
              required
            >
              {popularPlaces.map((place) => <option value={place} key={place}>{place}</option>)}
              <option value="custom">직접 입력</option>
            </select>
            {customDeparture && (
              <input
                className="taxi-custom-place"
                value={form.departure}
                maxLength={60}
                onChange={(event) => setForm({ ...form, departure: event.target.value })}
                placeholder="출발지를 입력해 주세요"
                autoFocus
                required
              />
            )}
          </label>
          <label>
            도착지
            <select
              value={customDestination ? 'custom' : form.destination}
              onChange={(event) => {
                const custom = event.target.value === 'custom'
                setCustomDestination(custom)
                setForm({ ...form, destination: custom ? '' : event.target.value })
              }}
              required={!customDestination}
            >
              <option value="" disabled>도착지를 선택해 주세요</option>
              {popularPlaces.map((place) => <option value={place} key={place}>{place}</option>)}
              <option value="custom">직접 입력</option>
            </select>
            {customDestination && (
              <input
                className="taxi-custom-place"
                value={form.destination}
                maxLength={60}
                onChange={(event) => setForm({ ...form, destination: event.target.value })}
                placeholder="도착지를 입력해 주세요"
                autoFocus
                required
              />
            )}
          </label>
          <label>출발 시간<input type="datetime-local" value={form.departureAt} onChange={(event) => setForm({ ...form, departureAt: event.target.value })} required /></label>
          <fieldset>
            <legend>전체 탑승 인원</legend>
            <div className="taxi-capacity-options">
              {[2, 3, 4].map((capacity) => (
                <button className={form.capacity === capacity ? 'is-selected' : ''} type="button" key={capacity} onClick={() => setForm({ ...form, capacity })}>{capacity}명</button>
              ))}
            </div>
          </fieldset>
          <label>메모<textarea value={form.note} maxLength={120} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="짐이 많아요, 정문 앞에서 만나요 등" /><small>{form.note.length}/120</small></label>
          {error && <p className="taxi-error" role="alert">{error}</p>}
          <button className="taxi-primary-button" type="submit" disabled={pendingId === 0}>{pendingId === 0 ? '만드는 중...' : '택시팟 만들기'}</button>
        </form>
      </div>
    )
  }

  return (
    <div className="taxi-section">
      <header className="taxi-page-header">
        <button type="button" onClick={onBack} aria-label="홈으로 돌아가기">←</button>
        <div><span>같이 타면 더 가볍게</span><h1>택시팟</h1></div>
        <button className="taxi-create-button" type="button" onClick={() => { setError(''); setCreating(true) }}>+ 팟 만들기</button>
      </header>

      <div className="taxi-content">
        <section className="taxi-hero">
          <span aria-hidden="true">🚕</span>
          <div><strong>목적지가 같은 학우를 찾아보세요</strong><small>연락처 공개 없이 참여할 수 있어요.</small></div>
        </section>

        <div className="taxi-filters" role="tablist" aria-label="택시팟 필터">
          <button className={filter === 'all' ? 'is-active' : ''} type="button" onClick={() => setFilter('all')}>모집 중</button>
          <button className={filter === 'mine' ? 'is-active' : ''} type="button" onClick={() => setFilter('mine')}>내 택시팟</button>
        </div>

        {error && <p className="taxi-error" role="alert">{error}</p>}
        {loading ? (
          <div className="taxi-empty">택시팟을 불러오고 있어요...</div>
        ) : visibleParties.length === 0 ? (
          <div className="taxi-empty"><span>🚖</span><strong>{filter === 'mine' ? '참여 중인 택시팟이 없어요' : '아직 모집 중인 택시팟이 없어요'}</strong><small>첫 번째 택시팟을 만들어 보세요.</small></div>
        ) : (
          <div className="taxi-party-list">
            {visibleParties.map((party) => {
              const unavailable = party.status !== 'open'
              return (
                <article className={`taxi-party-card${party.isMember ? ' is-joined' : ''}`} key={party.id}>
                  <div className="taxi-card-top"><time>{formatDepartureTime(party.departureAt)}</time><span className={`taxi-status ${party.status}`}>{party.status === 'open' ? '모집 중' : party.status === 'full' ? '모집 완료' : '마감'}</span></div>
                  <div className="taxi-route"><span></span><div><strong>{party.departure}</strong><small>출발</small><strong>{party.destination}</strong><small>도착</small></div></div>
                  {party.note && <p>{party.note}</p>}
                  <div className="taxi-card-meta"><span>{party.creatorDepartment} · {party.creatorName} 방장</span><strong>👤 {party.memberCount}/{party.capacity}</strong></div>
                  <div className="taxi-card-actions">
                    {party.isOwner ? (
                      <>
                        <button className="is-chat" type="button" onClick={() => setActiveChatParty(party)}>팟 채팅</button>
                        <button type="button" disabled={pendingId === party.id} onClick={() => runPartyAction(party.id, () => changeTaxiPartyStatus(party.id, party.status === 'closed' ? 'open' : 'closed'))}>{party.status === 'closed' ? '모집 다시 열기' : '모집 마감'}</button>
                        <button className="is-danger" type="button" disabled={pendingId === party.id} onClick={() => confirmDeleteParty(party)}>팟 삭제</button>
                      </>
                    ) : party.isMember ? (
                      <>
                        <button className="is-chat" type="button" onClick={() => setActiveChatParty(party)}>팟 채팅</button>
                        <button className="is-danger" type="button" disabled={pendingId === party.id} onClick={() => runPartyAction(party.id, () => leaveTaxiParty(party.id))}>참여 취소</button>
                      </>
                    ) : (
                      <button className="is-primary" type="button" disabled={unavailable || pendingId === party.id} onClick={() => runPartyAction(party.id, () => joinTaxiParty(party.id))}>{unavailable ? '참여 마감' : pendingId === party.id ? '참여 중...' : '참여하기'}</button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default TaxiPartySection

