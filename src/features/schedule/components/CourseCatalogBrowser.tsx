import { useEffect, useMemo, useState } from 'react'
import { loadCatalogManifest, loadCourseCatalog } from '../services/courseCatalog'
import type { CatalogCourse, CatalogSemester } from '../types/courseCatalog'

type CatalogCategory = 'major' | 'basic' | 'literacy' | 'advanced' | 'elective' | 'teaching' | 'elearning'

type CourseCatalogBrowserProps = {
  initialSemester: CatalogSemester
  onClose: () => void
  onDirectAdd: () => void
  onSelect: (course: CatalogCourse, semester: CatalogSemester) => void
}

const categories: Array<{ key: CatalogCategory; label: string; caption: string }> = [
  { key: 'major', label: '전공', caption: '대학·학과별 전공 강의' },
  { key: 'basic', label: '교양(기초)', caption: '기초교양 영역별 강의' },
  { key: 'literacy', label: '교양(소양)', caption: '소양교양 영역별 강의' },
  { key: 'advanced', label: '교양(심화)', caption: '심화교양 영역별 강의' },
  { key: 'elective', label: '자선', caption: '자유선택 강의' },
  { key: 'teaching', label: '교직', caption: '교직 이수 강의' },
  { key: 'elearning', label: '이러닝', caption: '온라인·혼합 강의' },
]

const classificationByCategory: Partial<Record<CatalogCategory, string>> = {
  basic: '기초', literacy: '소양', advanced: '심화', elective: '자선', teaching: '교직',
}

const favoritesStorageKey = 'course-catalog-favorites'

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
}

function semesterLabel(key: string) {
  const [year, semester] = key.split('-')
  return `${year}년 ${semester}학기`
}

function CourseCatalogBrowser({ initialSemester, onClose, onDirectAdd, onSelect }: CourseCatalogBrowserProps) {
  const [semester, setSemester] = useState<CatalogSemester>(initialSemester)
  const [semesters, setSemesters] = useState<CatalogSemester[]>([])
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [category, setCategory] = useState<CatalogCategory | null>(null)
  const [college, setCollege] = useState('')
  const [department, setDepartment] = useState('')
  const [area, setArea] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesStorageKey) ?? '[]') as string[]
      return new Set(saved)
    } catch {
      return new Set()
    }
  })

  const toggleFavorite = (key: string) => {
    setFavorites((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(favoritesStorageKey, JSON.stringify([...next]))
      return next
    })
  }

  const sortByFavorite = <T,>(items: T[], getKey: (item: T) => string) => (
    [...items].sort((first, second) => Number(favorites.has(getKey(second))) - Number(favorites.has(getKey(first))))
  )

  useEffect(() => {
    loadCatalogManifest()
      .then((manifest) => {
        const available = manifest.semesters.map((item) => item.key).reverse()
        setSemesters(available)
        if (!available.includes(initialSemester) && available[0]) setSemester(available[0])
      })
      .catch(() => setError('학기 목록을 불러오지 못했습니다.'))
  }, [initialSemester])

  useEffect(() => {
    let active = true
    loadCourseCatalog(semester)
      .then((payload) => {
        if (active) setCourses(payload.courses)
      })
      .catch(() => {
        if (active) setError('강의 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [semester])

  const categoryCourses = useMemo(() => {
    if (!category) return []
    if (category === 'elearning') return courses.filter((course) => course.isElearning)
    if (category === 'major') {
      return courses.filter((course) => ['전필', '전선'].includes(course.classification) && !course.isElearning)
    }
    return courses.filter((course) => course.classification === classificationByCategory[category] && !course.isElearning)
  }, [category, courses])

  const colleges = useMemo(() => uniqueSorted(categoryCourses.map((course) => course.college)), [categoryCourses])
  const departments = useMemo(
    () => uniqueSorted(categoryCourses.filter((course) => course.college === college).map((course) => course.department)),
    [categoryCourses, college],
  )
  const areas = useMemo(() => uniqueSorted(categoryCourses.map((course) => course.area)), [categoryCourses])

  const visibleCourses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko')
    let filtered = normalized
      ? courses.filter((course) => [course.name, course.professor, course.subjectCode, course.department]
          .some((value) => value.toLocaleLowerCase('ko').includes(normalized)))
      : categoryCourses

    if (!normalized && category === 'major') {
      if (!college || !department) return []
      filtered = filtered.filter((course) => course.college === college && course.department === department)
    }
    if (!normalized && ['basic', 'literacy', 'advanced'].includes(category ?? '')) {
      if (!area) return []
      filtered = filtered.filter((course) => course.area === area)
    }
    return filtered
  }, [area, category, categoryCourses, college, courses, department, query])

  const resetPath = (nextCategory: CatalogCategory | null) => {
    setCategory(nextCategory)
    setCollege('')
    setDepartment('')
    setArea('')
    setQuery('')
  }

  const showCourseList = Boolean(query.trim())
    || Boolean(category && !['major', 'basic', 'literacy', 'advanced'].includes(category))
    || Boolean(category === 'major' && college && department)
    || Boolean(category && ['basic', 'literacy', 'advanced'].includes(category) && area)

  return (
    <section className="schedule-modal catalog-browser-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
      <header className="catalog-header">
        <button type="button" onClick={onClose} aria-label="닫기">×</button>
        <div><span>시간표 만들기</span><h2 id="catalog-title">과목 찾아 추가</h2></div>
        <button className="catalog-direct-button" type="button" onClick={onDirectAdd}>직접 추가</button>
      </header>

      <div className="catalog-toolbar">
        <select value={semester} onChange={(event) => {
          setLoading(true)
          setError('')
          setSemester(event.target.value as CatalogSemester)
          resetPath(null)
        }} aria-label="강의 개설 학기">
          {(semesters.length ? semesters : [semester]).map((item) => <option key={item} value={item}>{semesterLabel(item)}</option>)}
        </select>
        <label className="catalog-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="과목명, 교수명, 학수번호 검색" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">×</button>}
        </label>
      </div>

      {!query && category && (
        <nav className="catalog-breadcrumb" aria-label="선택 경로">
          <button type="button" onClick={() => resetPath(null)}>전체</button><span>›</span>
          <button type="button" onClick={() => resetPath(category)}>{categories.find((item) => item.key === category)?.label}</button>
          {college && <><span>›</span><button type="button" onClick={() => { setDepartment(''); setCollege(college) }}>{college}</button></>}
          {department && <><span>›</span><b>{department}</b></>}
          {area && <><span>›</span><b>{area}</b></>}
        </nav>
      )}

      <div className="catalog-scroll-area">
        {loading && <p className="catalog-status">강의 목록을 불러오는 중입니다.</p>}
        {error && <p className="catalog-status is-error">{error}</p>}

        {!loading && !error && !query && !category && (
          <div className="catalog-category-list">
            {sortByFavorite(categories, (item) => `category:${item.key}`).map((item) => (
              <div className="catalog-category-row" key={item.key}>
                <FavoriteButton
                  active={favorites.has(`category:${item.key}`)}
                  label={item.label}
                  onClick={() => toggleFavorite(`category:${item.key}`)}
                />
                <button className="catalog-row-select" type="button" onClick={() => resetPath(item.key)}>
                  <span><strong>{item.label}</strong><small>{item.caption}</small></span>
                  <b>›</b>
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !query && category === 'major' && !college && (
          <CatalogOptionList title="대학을 선택하세요" values={colleges} favoritePrefix="major:college" favorites={favorites} onToggleFavorite={toggleFavorite} onSelect={setCollege} />
        )}
        {!loading && !query && category === 'major' && college && !department && (
          <CatalogOptionList title="학과·전공을 선택하세요" values={departments} favoritePrefix={`major:${college}:department`} favorites={favorites} onToggleFavorite={toggleFavorite} onSelect={setDepartment} />
        )}
        {!loading && !query && category && ['basic', 'literacy', 'advanced'].includes(category) && !area && (
          <CatalogOptionList title="영역을 선택하세요" values={areas} favoritePrefix={`${category}:area`} favorites={favorites} onToggleFavorite={toggleFavorite} onSelect={setArea} />
        )}

        {!loading && showCourseList && (
          <div className="catalog-course-list">
            <div className="catalog-result-heading"><strong>강의 {visibleCourses.length.toLocaleString()}개</strong><span>시간·강의실·교수 정보가 자동 적용됩니다.</span></div>
            {visibleCourses.slice(0, 250).map((course) => (
              <button type="button" onClick={() => onSelect(course, semester)} key={course.id}>
                <span className="catalog-course-main">
                  <strong>{course.name}</strong>
                  <small>{course.professor || '담당교수 미정'}</small>
                  <em>{course.sourceSchedule || [course.college, course.department].filter(Boolean).join(' · ') || '시간 미정'}</em>
                </span>
                <span className="catalog-course-meta">
                  <b>{course.credits}학점</b>
                  <small>{course.classification}{course.area ? ` · ${course.area}` : ''}</small>
                  <small>{course.subjectCode}-{course.section}</small>
                </span>
              </button>
            ))}
            {!visibleCourses.length && <p className="catalog-status">조건에 맞는 강의가 없습니다.</p>}
            {visibleCourses.length > 250 && <p className="catalog-limit-note">검색 결과가 많아 250개까지만 표시합니다. 검색어로 좁혀 주세요.</p>}
          </div>
        )}
      </div>
    </section>
  )
}

function FavoriteButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`catalog-favorite ${active ? 'is-active' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={`${label} ${active ? '상단 고정 해제' : '상단 고정'}`}
      aria-pressed={active}
    >
      {active ? '★' : '☆'}
    </button>
  )
}

type CatalogOptionListProps = {
  title: string
  values: string[]
  favoritePrefix: string
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  onSelect: (value: string) => void
}

function CatalogOptionList({ title, values, favoritePrefix, favorites, onToggleFavorite, onSelect }: CatalogOptionListProps) {
  const sortedValues = [...values].sort((first, second) => (
    Number(favorites.has(`${favoritePrefix}:${second}`)) - Number(favorites.has(`${favoritePrefix}:${first}`))
  ))
  return (
    <div className="catalog-option-panel">
      <p>{title}</p>
      {sortedValues.map((value) => {
        const favoriteKey = `${favoritePrefix}:${value}`
        return (
          <div className="catalog-option-row" key={value}>
            <FavoriteButton active={favorites.has(favoriteKey)} label={value} onClick={() => onToggleFavorite(favoriteKey)} />
            <button className="catalog-row-select" type="button" onClick={() => onSelect(value)}><strong>{value}</strong><b>›</b></button>
          </div>
        )
      })}
    </div>
  )
}

export default CourseCatalogBrowser
