import { useEffect, useMemo, useRef, useState } from 'react';
import { PLACES, type Place } from '../data/places';
import { BUILDINGS, BUILDING_CATEGORIES } from '../data/buildings';
import '../map.css';
import PlaceSuggestion from './PlaceSuggestion';
import { REPRESENTATIVE_MENUS } from '../data/menus';

type Coordinate = { lat(): number; lng(): number };
type MapInstance = { setCenter(p: Coordinate): void; setZoom(z: number): void; destroy(): void };
type MarkerInstance = { setMap(m: MapInstance | null): void };
type Geocoder = {
  Status: { OK: number };
  geocode(options: { query: string; coordinate: string }, callback: (status: number, response?: { v2?: { addresses?: { x: string; y: string }[] } }) => void): void;
};
type Maps = {
  Service?: Geocoder;
  LatLng: new (lat: number, lng: number) => Coordinate;
  Map: new (el: HTMLElement, options: { center: Coordinate; zoom: number; zoomControl: boolean }) => MapInstance;
  Point: new (x: number, y: number) => object;
  Marker: new (options: { position: Coordinate; map: MapInstance; title: string; icon: { content: HTMLElement; anchor: object }; zIndex: number }) => MarkerInstance;
  Event: {
    addListener(target: MapInstance | MarkerInstance, name: string, callback: (event: { coord: Coordinate }) => void): unknown;
    removeListener(listener: unknown): void;
  };
};
declare global { interface Window { naver?: { maps: Maps }; navermap_authFailure?: () => void } }
const CENTER = { lat: 36.9487809, lng: 127.9124301 };
const OUTSIDE_CATEGORIES = ['밥집', '카페', '술집', '편의점', '기타생활', '기타오락'];
const MAP_AUTH_FAILURE_EVENT = 'naver-map-auth-failure';
let scriptPromise: Promise<void> | undefined;
function loadNaverScript() {
  if (window.naver?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    window.navermap_authFailure = () => window.dispatchEvent(new Event(MAP_AUTH_FAILURE_EVENT));
    const key = import.meta.env.VITE_NAVER_MAP_KEY;
    if (!key) { reject(new Error('.env.local의 VITE_NAVER_MAP_KEY를 확인하고 개발 서버를 다시 켜줘.')); return; }
    const existing = document.getElementById('naver-map-script') as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const finish = () => {
      clearTimeout(timer);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onError = () => { finish(); script.remove(); reject(new Error('지도 연결 실패. 네이버 콘솔의 localhost:5173 등록, 키 이름, 콘솔 오류 순서로 확인해 줘.')); };
    const onLoad = () => { if (!window.naver?.maps) { onError(); return; } finish(); resolve(); };
    const timer = window.setTimeout(onError, 15000);
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existing) {
      script.id = 'naver-map-script';
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder`;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => { scriptPromise = undefined; throw error; });
  return scriptPromise;
}
function hasCoordinates(place: Place): place is Place & { lat: number; lng: number } {
  return typeof place.lat === 'number' && typeof place.lng === 'number' &&
    Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180;
}

const CACHE_KEY = 'campus-map-coordinates-v1';
type CachedCoordinate = { lat: number; lng: number; address: string };
function readCoordinates(): Record<string, CachedCoordinate> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, p]) =>
      p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
      Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
      Math.abs(p.lat - CENTER.lat) < 0.15 && Math.abs(p.lng - CENTER.lng) < 0.15 && typeof p.address === 'string'));
  } catch { return {}; }
}
function geocodeAddress(service: Geocoder, address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('주소 검색 응답이 없어. Geocoding 설정과 네트워크를 확인해 줘.')), 10000);
    service.geocode({ query: address, coordinate: `${CENTER.lng},${CENTER.lat}` }, (status, response) => {
      clearTimeout(timer);
      if (status !== service.Status.OK) { reject(new Error('주소 검색 실패. 네이버 콘솔에서 Geocoding 사용 설정을 확인해 줘.')); return; }
      const addresses = response?.v2?.addresses ?? [];
      if (addresses.length !== 1) { resolve(null); return; }
      const lat = Number(addresses[0].y), lng = Number(addresses[0].x);
      resolve(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat - CENTER.lat) < 0.15 && Math.abs(lng - CENTER.lng) < 0.15 ? { lat, lng } : null);
    });
  });
}

export default function MapSection() {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapInstance | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<'inside' | 'outside'>('outside');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [selected, setSelected] = useState<Place | null>(null);
  const [helper, setHelper] = useState(false);
  const [coordinate, setCoordinate] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [coordinates, setCoordinates] = useState(readCoordinates);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState('');
  const geocodeRun = useRef(0);
  useEffect(() => () => { geocodeRun.current += 1; }, []);
  const outdoorPlaces = useMemo(() => PLACES.map(place => {
    const cached = coordinates[place.id];
    return !hasCoordinates(place) && cached?.address === place.address ? { ...place, lat: cached.lat, lng: cached.lng } : place;
  }), [coordinates]);
  const data = mode === 'inside' ? BUILDINGS : outdoorPlaces;
  const categories = mode === 'inside' ? BUILDING_CATEGORIES : OUTSIDE_CATEGORIES;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return data.filter(p => (category === '전체' || p.category === category) &&
      `${p.name} ${p.address} ${p.description}`.toLocaleLowerCase().includes(term));
  }, [data, category, query]);
  const located = filtered.filter(hasCoordinates).length;

  useEffect(() => {
    const handleAuthFailure = () => {
      setMap(null);
      setError('네이버 지도 인증에 실패했습니다. 네이버 클라우드에서 Dynamic Map을 선택하고 Web 서비스 URL에 http://localhost:5173을 등록해 주세요.');
    };
    window.addEventListener(MAP_AUTH_FAILURE_EVENT, handleAuthFailure);
    return () => window.removeEventListener(MAP_AUTH_FAILURE_EVENT, handleAuthFailure);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let instance: MapInstance | undefined;
    loadNaverScript().then(() => {
      if (cancelled || !container.current || !window.naver) return;
      const maps = window.naver.maps;
      instance = new maps.Map(container.current, { center: new maps.LatLng(CENTER.lat, CENTER.lng), zoom: 14, zoomControl: true });
      setMap(instance);
    }).catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '지도 연결 실패'); });
    return () => { cancelled = true; instance?.destroy(); };
  }, [attempt]);

  useEffect(() => {
    if (!map || !window.naver) return;
    map.setCenter(new window.naver.maps.LatLng(mode === 'inside' ? 36.9494 : CENTER.lat, mode === 'inside' ? 127.9083 : CENTER.lng));
    map.setZoom(mode === 'inside' ? 16 : 14);
  }, [map, mode]);

  useEffect(() => {
    if (!map || !window.naver) return;
    const maps = window.naver.maps;
    const element = container.current;
    const onMarkerClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>('[data-place-id]');
      const place = filtered.find(item => item.id === button?.dataset.placeId);
      if (place) { event.stopPropagation(); setSelected(place); }
    };
    element?.addEventListener('click', onMarkerClick, true);
    const markers = filtered.filter(hasCoordinates).map(place => {
      const active = selected?.id === place.id;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.placeId = place.id;
      button.className = `cm-marker ${active ? 'is-active' : ''}`;
      button.setAttribute('aria-label', `${place.name} 정보 보기`);
      button.setAttribute('aria-pressed', String(active));
      button.title = place.name;
      button.innerHTML = active
        ? '<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39C12 33 1 22 1 15a14 14 0 1 1 28 0c0 7-11 18-14 24Z" fill="#166b49" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="white"/></svg>'
        : '<span class="cm-marker-dot"></span>';
      const onClick = (event: MouseEvent) => { event.stopPropagation(); setSelected(place); };
      button.addEventListener('click', onClick);
      const marker = new maps.Marker({ map, position: new maps.LatLng(place.lat, place.lng), title: place.name,
        icon: { content: button, anchor: new maps.Point(active ? 15 : 12, active ? 40 : 12) }, zIndex: active ? 1000 : 1 });
      const listener = maps.Event.addListener(marker, 'click', () => setSelected(place));
      return { marker, listener, button, onClick };
    });
    return () => {
      element?.removeEventListener('click', onMarkerClick, true);
      markers.forEach(({ marker, listener, button, onClick }) => { button.removeEventListener('click', onClick); maps.Event.removeListener(listener); marker.setMap(null); });
    };
  }, [map, filtered, selected]);

  useEffect(() => {
    if (!map || !helper || !window.naver) return;
    const maps = window.naver.maps;
    let active = true;
    const listener = maps.Event.addListener(map, 'click', event => {
      const text = `${event.coord.lat().toFixed(7)}, ${event.coord.lng().toFixed(7)}`;
      setCoordinate(text);
      setCopyMessage('');
      navigator.clipboard?.writeText(text).then(() => { if (active) setCopyMessage('좌표 복사 완료'); })
        .catch(() => { if (active) setCopyMessage('아래 좌표를 선택해서 복사해 줘'); });
    });
    return () => { active = false; maps.Event.removeListener(listener); };
  }, [map, helper]);

  useEffect(() => {
    if (map && selected && hasCoordinates(selected) && window.naver) {
      map.setCenter(new window.naver.maps.LatLng(selected.lat, selected.lng));
      map.setZoom(18);
    }
  }, [map, selected]);

  async function locateOutdoorPlaces() {
    const service = window.naver?.maps.Service;
    if (!service) { setGeocodeMessage('주소 검색 모듈을 불러오려면 페이지를 새로고침해 줘.'); return; }
    const run = ++geocodeRun.current;
    const next = { ...coordinates };
    const pending = outdoorPlaces.filter(p => !hasCoordinates(p));
    const missed: string[] = [];
    const addressResults = new Map<string, { lat: number; lng: number } | null>();
    let completed = 0;
    let storageFailed = false;
    setGeocoding(true);
    setSelected(null);
    try {
      for (const place of pending) {
        if (run !== geocodeRun.current) return;
        setGeocodeMessage(`주소 확인 중 ${++completed}/${pending.length} · ${place.name}`);
        // 층·호수·상호는 제외하되 원본 주소는 그대로 보존한다.
        const address = place.address.match(/^.*?(?:로|길|동|리)\s+\d+(?:-\d+)?/)?.[0] || place.address;
        let point = addressResults.get(address);
        if (point === undefined) { point = await geocodeAddress(service, address); addressResults.set(address, point); }
        if (run !== geocodeRun.current) return;
        if (point) {
          next[place.id] = { ...point, address: place.address };
          setCoordinates({ ...next });
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { storageFailed = true; }
        } else missed.push(place.name);
      }
      setGeocodeMessage(`완료 · ${pending.length - missed.length}곳 추가${missed.length ? ` · 위치 확인 필요: ${missed.join(', ')}` : ''}${storageFailed ? ' · 브라우저 저장 실패: 새로고침하면 다시 불러와야 해.' : ' · 이 브라우저에 저장했어.'}`);
    } catch (e: unknown) {
      if (run === geocodeRun.current) setGeocodeMessage(e instanceof Error ? e.message : '주소 검색 실패');
    } finally { if (run === geocodeRun.current) setGeocoding(false); }
  }

  function changeMode(next: 'inside' | 'outside') {
    setMode(next); setCategory('전체'); setQuery(''); setSelected(null);
  }
  return (
    <section className="feature-page campus-map">
      <header className="cm-page-header">
        <div>
          <span>KU GLOCAL CAMPUS</span>
          <h2>캠퍼스 지도</h2>
          <p>교내 건물부터 학교 앞 맛집까지 한 번에 찾아보세요.</p>
        </div>
        <span className="cm-live-badge"><i aria-hidden="true" /> {located}곳 표시 중</span>
      </header>
      <div className="cm-layout">
        <aside className="cm-sidebar" aria-label="장소 검색과 목록">
          <div className="cm-switch">
            <button type="button" aria-pressed={mode === 'inside'} onClick={() => changeMode('inside')}><span aria-hidden="true">🏫</span> 교내</button>
            <button type="button" aria-pressed={mode === 'outside'} onClick={() => changeMode('outside')}><span aria-hidden="true">📍</span> 교외</button>
          </div>
          <label className="cm-search">
            <span aria-hidden="true" className="cm-search-icon">⌕</span>
            <span className="cm-sr-only">장소 이름 또는 주소 검색</span>
            <input type="search" placeholder={mode === 'inside' ? '건물 이름을 검색해 보세요' : '맛집, 카페, 주소 검색'} value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} />
            {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}>×</button>}
          </label>
          <div className="cm-filters" aria-label="카테고리">
            {['전체', ...categories].map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setSelected(null); }}>{item}</button>)}
          </div>
          {mode === 'outside' && outdoorPlaces.some(p => !hasCoordinates(p)) && <div className="cm-geocode">
            <button type="button" disabled={!map || geocoding} onClick={() => void locateOutdoorPlaces()}>{geocoding ? '좌표 불러오는 중…' : '교외 좌표 불러오기'}</button>
            <small>네이버 콘솔에서 Geocoding을 켠 뒤 눌러줘.</small>
            {geocodeMessage && <p role="status">{geocodeMessage}</p>}
          </div>}
        </aside>
        <div className="cm-right">
          <div className="cm-map-wrap">
            <div ref={container} className="cm-map" aria-label="건국대학교 글로컬캠퍼스 주변 지도" />
            {!map && !error && <div className="cm-map-message" role="status">지도를 불러오는 중…</div>}
            {error && <div className="cm-map-message" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setAttempt(n => n + 1); }}>다시 연결</button></div>}
            {map && located === 0 && <p className="cm-map-notice">좌표가 등록되면 장소 마커가 표시돼</p>}
            <button type="button" className="cm-recenter" aria-label="지도 중심으로 돌아가기" onClick={() => {
              if (!map || !window.naver) return;
              map.setCenter(new window.naver.maps.LatLng(mode === 'inside' ? 36.9494 : CENTER.lat, mode === 'inside' ? 127.9083 : CENTER.lng));
              map.setZoom(mode === 'inside' ? 16 : 14);
              setSelected(null);
            }}>◎</button>
          </div>
          <div className="cm-helper">
            <label><input type="checkbox" checked={helper} onChange={e => setHelper(e.target.checked)} /> 좌표찍기 도우미</label>
            {helper && <><span>지도를 클릭하면 좌표가 복사돼</span>{coordinate && <input aria-label="마지막으로 찍은 좌표" readOnly value={coordinate} onFocus={e => e.target.select()} />}<span role="status">{copyMessage}</span></>}
          </div>
          {selected ? <article className="cm-detail" aria-label="장소 상세 정보">
            <button type="button" className="cm-close" aria-label="상세 정보 닫기" onClick={() => setSelected(null)}>×</button>
            <span className="cm-category">{selected.category}</span><h3>{selected.name}</h3>
            {!hasCoordinates(selected) && <p className="cm-pending">위치를 확인 중이야. 아직 지도에는 표시되지 않아.</p>}
            <dl><dt>주소</dt><dd>{selected.address || '정보 없음'}</dd>{mode === 'outside' && <><dt>운영시간</dt><dd>{selected.hours || '정보 없음'}</dd><dt>전화</dt><dd>{selected.phone ? <a href={`tel:${selected.phone.replace(/[^+0-9]/g, '')}`}>{selected.phone}</a> : '정보 없음'}</dd></>}</dl>
            {mode === 'outside' && (selected.category === '밥집' || selected.category === '술집') && REPRESENTATIVE_MENUS[selected.id] && <div className="cm-menu"><span>★ 대표메뉴</span><strong>{REPRESENTATIVE_MENUS[selected.id]}</strong></div>}
            {mode === 'outside' && selected.description && <p className="cm-description">{selected.description.split('\n').map(line => line.trim()).filter(Boolean).map(line => `*${line}`).join('\n')}</p>}
            {mode === 'outside' && selected.source && <small>출처: {selected.source}</small>}
            {mode === 'outside' && <PlaceSuggestion key={selected.id} place={selected} />}
          </article> : null}
        </div>
        <section className="cm-results" aria-label="검색된 장소">
          <div className="cm-results-heading">
            <div><span>{mode === 'inside' ? 'CAMPUS' : 'AROUND KU'}</span><h3>{category === '전체' ? (mode === 'inside' ? '교내 장소' : '학교 주변 추천') : category}</h3></div>
            <p className="cm-count" aria-live="polite">{filtered.length}곳</p>
          </div>
          <div className="cm-list">
            {filtered.length === 0 && <p className="cm-empty">{data.length === 0 ? '교내 건물 목록을 준비 중이에요.' : '검색 결과가 없어요. 검색어나 카테고리를 바꿔 보세요.'}</p>}
            {filtered.map(place => <button type="button" key={place.id} className={`cm-place ${selected?.id === place.id ? 'is-selected' : ''}`} aria-pressed={selected?.id === place.id} onClick={() => setSelected(place)}>
              <span className="cm-place-top"><strong>{place.name}</strong><span className="cm-category">{place.category}</span></span>
              <span className="cm-address">{place.address || '주소 정보 준비 중'}</span>
              <span className="cm-place-footer"><span>{hasCoordinates(place) ? '지도에서 보기' : '위치 확인 중'}</span><b aria-hidden="true">→</b></span>
            </button>)}
          </div>
        </section>
      </div>
    </section>
  );
}
