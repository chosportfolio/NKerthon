import { useState, type FormEvent } from 'react';
import type { Place } from '../data/places';

type Suggestion = { id: string; placeId: string; placeName: string; field: string; current: string; proposed: string; note: string; createdAt: string };
const STORAGE_KEY = 'campus-map-suggestions-v1';
function readSuggestions(): Suggestion[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item): item is Suggestion => item &&
      ['id', 'placeId', 'placeName', 'field', 'current', 'proposed', 'note', 'createdAt'].every(key => typeof item[key] === 'string')) : [];
  } catch { return []; }
}

export default function PlaceSuggestion({ place }: { place: Place }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState('운영시간');
  const [proposed, setProposed] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Suggestion[] | null>(null);
  const current = field === '운영시간' ? place.hours : field === '전화번호' ? place.phone : field === '주소' ? place.address : place.description;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposed.trim()) { setMessage('수정할 내용을 입력해 줘.'); return; }
    try {
      const next = [...readSuggestions(), { id: crypto.randomUUID(), placeId: place.id, placeName: place.name,
        field, current, proposed: proposed.trim(), note: note.trim(), createdAt: new Date().toISOString() }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHistory(history ? next : null);
      setOpen(false); setProposed(''); setNote('');
      setMessage('제보를 이 브라우저에 저장했어. 관리자에게 전송되지는 않아.');
    } catch { setMessage('저장하지 못했어. 브라우저 저장 공간을 확인하고 다시 시도해 줘.'); }
  }
  return <div className="cm-suggestion">
    <button type="button" className="cm-suggest-button" aria-expanded={open} onClick={() => { setOpen(!open); setMessage(''); }}>✎ 정보 수정 제안하기</button>
    {open && <form onSubmit={submit} className="cm-suggest-form">
      <strong>{place.name} 정보 수정 제안</strong>
      <label>수정할 항목<select value={field} onChange={event => { setField(event.target.value); setProposed(''); }}>
        {['운영시간', '전화번호', '주소', '기타 정보'].map(item => <option key={item}>{item}</option>)}
      </select></label>
      <p className="cm-current-info">현재 정보: {current || '정보 없음'}</p>
      <label>수정할 내용<textarea required maxLength={1000} value={proposed} onChange={event => setProposed(event.target.value)} placeholder={field === '운영시간' ? '예: 월~금 09:00~22:00, 일요일 휴무' : '올바른 정보를 입력해 줘'} /></label>
      <label>추가 설명 (선택)<textarea maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="확인한 날짜나 수정 이유를 적어 줘" /></label>
      <p className="cm-report-notice">시연용이야. 제보는 이 브라우저에 저장돼. 개인정보는 적지 마.</p>
      <div className="cm-suggest-actions"><button type="button" onClick={() => setOpen(false)}>취소</button><button type="submit">제보 저장하기</button></div>
    </form>}
    {message && <p role="status" className="cm-report-notice">{message}</p>}
    <button type="button" className="cm-report-history-button" aria-expanded={history !== null} onClick={() => setHistory(history ? null : readSuggestions())}>관리자 제보 확인 (시연용)</button>
    {history && <div className="cm-report-history" aria-label="저장된 제보 내역">
      <strong>관리자 제보함 · {history.length}건</strong>
      {history.length === 0 && <p>아직 제보가 없어.</p>}
      {[...history].reverse().map(item => <article key={item.id}><strong>{item.placeName} · {item.field}</strong><p>기존: {item.current || '정보 없음'}</p><p>제안: {item.proposed}</p>{item.note && <p>설명: {item.note}</p>}<small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small></article>)}
    </div>}
  </div>;
}
