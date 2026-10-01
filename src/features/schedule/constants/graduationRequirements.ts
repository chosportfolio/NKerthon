import { graduationRequirementData } from '../data/graduationRequirementData'

export type GraduationRequirement = {
  year: number
  department: string
  liberal: number
  liberalBasic: number
  liberalAdvanced: number
  liberalCulture: number
  majorRequired: number
  majorElective: number
  majorTotal: number
  graduation: number
}

export type RequiredCourseGroup = {
  label: string
  alternatives: string[]
}

export type LiberalCurriculumArea = {
  key: 'basic' | 'advanced' | 'culture'
  label: string
  description: string
  highlights: string[]
  requiredGroups: RequiredCourseGroup[]
  criteria: Array<{ label: string; credits: string; note?: string; requiredGroups?: RequiredCourseGroup[] }>
}

export const admissionYears = Array.from({ length: 10 }, (_, index) => 2017 + index)

const liberalBreakdown: Record<number, { basic: number; advanced: number }> = {
  2017: { basic: 15, advanced: 8 },
  2018: { basic: 18, advanced: 8 },
  2019: { basic: 18, advanced: 8 },
  2020: { basic: 18, advanced: 8 },
  2021: { basic: 18, advanced: 8 },
  2022: { basic: 18, advanced: 8 },
  2023: { basic: 18, advanced: 8 },
  2024: { basic: 18, advanced: 8 },
  2025: { basic: 14, advanced: 8 },
  2026: { basic: 14, advanced: 8 },
}

const writingChoices = ['창의글쓰기', '실용글쓰기', '성찰글쓰기', '미디어글쓰기']
const presentationChoices = [
  '비판적사고와토론',
  '공감적소통과발표',
  '열린사고와실용적말하기',
  '협력적사고와토의',
]
const aiDataChoices = ['컴퓨팅적사고', '데이터리터러시', 'AI리터러시', '빅데이터의기초', '프로그래밍의기초']

const normalize = (value: string) => value.replace(/[\s·()]/g, '').toLowerCase()
const normalizeDepartment = (value: string) => normalize(value).replace(/(학과|전공)$/u, '')

export function inferAdmissionYear(studentNumber: string) {
  const year = Number(studentNumber.match(/^(20\d{2})/)?.[1])
  return admissionYears.includes(year) ? year : 2026
}

export function getGraduationRequirement(department: string, year: number): GraduationRequirement | null {
  const exact = graduationRequirementData.find(
    (item) => item.year === year && normalize(item.department) === normalize(department),
  )
  const matched = exact ?? graduationRequirementData.find(
    (item) => item.year === year && normalizeDepartment(item.department) === normalizeDepartment(department),
  )
  if (!matched || !matched.graduation) return null

  const breakdown = liberalBreakdown[year]
  const normalizedDepartment = normalizeDepartment(matched.department)
  const isNursing = normalizedDepartment === normalizeDepartment('간호학과')
  const isMedicine = normalizedDepartment === normalizeDepartment('의예과')
  const standardLiberal = year === 2017
    ? (matched.liberal || 38)
    : year <= 2019
      ? 36
      : year <= 2024
        ? 35
        : 31
  const liberal = isNursing && year >= 2018
    ? year <= 2019 ? 30 : year <= 2021 ? 29 : year <= 2024 ? 29 : 25
    : isMedicine && year >= 2022
      ? standardLiberal - 4
      : standardLiberal
  return {
    ...matched,
    liberal,
    liberalBasic: breakdown.basic,
    liberalAdvanced: breakdown.advanced,
    liberalCulture: Math.max(0, liberal - breakdown.basic - breakdown.advanced),
  }
}

export function isRequiredCourseCompleted(courseNames: string[], group: RequiredCourseGroup) {
  const normalizedNames = new Set(courseNames.map(normalize))
  return group.alternatives.some((course) => normalizedNames.has(normalize(course)))
}

export function getLiberalCurriculumAreas(year: number, department: string): LiberalCurriculumArea[] {
  const normalizedDepartment = normalizeDepartment(department)
  const isNursing = normalizedDepartment === normalizeDepartment('간호학과')
  const isMedicine = normalizedDepartment === normalizeDepartment('의예과')
  const isBioMedicine = ['바이오의약학과', '바이오의약학전공']
    .some((item) => normalizeDepartment(item) === normalizedDepartment)
  const isBioEngineering = normalizeDepartment('바이오생명공학전공') === normalizedDepartment
  const needsScience = year >= 2025
    ? isMedicine
    : year >= 2022
      ? isBioMedicine || isMedicine
      : year === 2021
        ? isBioMedicine
        : year >= 2018
          ? isBioMedicine || isBioEngineering
          : false

  const basicRequired = year === 2017
    ? [
        { label: '글쓰기', alternatives: ['글쓰기'] },
        { label: '컴퓨팅적사고', alternatives: ['컴퓨팅적사고'] },
        { label: 'KUGEP1', alternatives: ['KUGEP1'] },
      ]
    : year <= 2021
      ? [
          { label: '글쓰기', alternatives: ['글쓰기'] },
          { label: '발표와토론', alternatives: ['발표와토론'] },
          { label: 'KUGEP1', alternatives: ['KUGEP1'] },
        ]
      : [
          { label: '글쓰기 영역 택1', alternatives: writingChoices },
          { label: '발표와토론 영역 택1', alternatives: presentationChoices },
          { label: 'KUGEP1', alternatives: ['KUGEP1'] },
          ...(year >= 2025 ? [{ label: 'AI/데이터 영역 택1', alternatives: aiDataChoices }] : []),
        ]

  if (needsScience) {
    basicRequired.push(
      { label: '대학기초생물학', alternatives: ['대학기초생물학'] },
      { label: '대학기초화학', alternatives: ['대학기초화학'] },
    )
  }

  const cultureRequired: RequiredCourseGroup[] = year <= 2019
    ? [
        { label: '성신의대학생활지도1', alternatives: ['성신의대학생활지도1'] },
        { label: '성신의대학생활지도2', alternatives: ['성신의대학생활지도2'] },
      ]
    : [{ label: '성신의대학생활지도', alternatives: ['성신의대학생활지도'] }]

  if (!isNursing && !(isMedicine && year >= 2022)) {
    cultureRequired.push(year === 2017
      ? { label: '취업전략수립및커리어개발', alternatives: ['취업전략수립및커리어개발'] }
      : { label: '취업전략수립및역량개발1', alternatives: ['취업전략수립및역량개발1'] })
  }

  const basicDescription = year === 2017
    ? '의사소통 3 · 국제화 6 · 인문사고 4 · 과학사고 2'
    : year <= 2021
      ? '의사소통 6 · 국제화 6 · 인문사고 3 · 과학사고 3'
      : year <= 2024
        ? '글쓰기 3 · 발표와토론 3 · 외국어 6 · 인문 3 · 과학 3'
        : '글쓰기 2 · 발표와토론 2 · 외국어 4 · 인문 2 · 과학 2 · AI/데이터 2'

  const cultureDescription = year === 2017
    ? 'KU인성 3 · 실무소양 6 · 계열핵심 6~9'
    : year <= 2019
      ? isNursing ? '간호학과는 KU소양 면제' : 'KU인성 4 · KU소양 6'
      : year <= 2021
        ? isNursing ? '간호학과는 KU소양 면제' : 'KU인성 3 · KU소양 6'
        : isNursing
          ? '간호학과는 인성 영역 3학점'
          : isMedicine
            ? '의예과는 인성 3 + 실무 또는 실기 2'
            : 'KU소양 9 (인성 3 + 실무 4 + 실기 2)'

  const basicCriteria = year >= 2025
    ? [
        { label: '글쓰기', credits: '2학점', note: '영역 택1' },
        { label: '발표와토론', credits: '2학점', note: '영역 택1' },
        { label: '외국어기초', credits: '4학점', note: 'KUGEP1 필수' },
        { label: '인문기초', credits: '2학점' },
        { label: '과학기초', credits: '2학점' },
        { label: 'AI/데이터', credits: '2학점', note: '영역 택1' },
      ]
    : year >= 2022
      ? [
          { label: '글쓰기', credits: '3학점', note: '영역 택1' },
          { label: '발표와토론', credits: '3학점', note: '영역 택1' },
          { label: '외국어기초', credits: '6학점', note: 'KUGEP1 필수' },
          { label: '인문기초', credits: '3학점' },
          { label: '과학기초', credits: '3학점' },
        ]
      : year >= 2018
        ? [
            { label: '의사소통', credits: '6학점', note: '글쓰기·발표와토론 필수' },
            { label: '국제화', credits: '6학점', note: 'KUGEP1 필수' },
            { label: '인문사고', credits: '3학점' },
            { label: '과학사고', credits: '3학점' },
          ]
        : [
            { label: '의사소통', credits: '3학점', note: '글쓰기 필수' },
            { label: '국제화', credits: '6학점', note: 'KUGEP1 필수' },
            { label: '인문사고', credits: '4학점' },
            { label: '과학사고', credits: '2학점', note: '컴퓨팅적사고 필수' },
          ]

  const advancedCriteria = (year >= 2022
    ? ['글로벌언어', '인간과문화', '인간과사회', '과학과기술', '예술과체육', '융복합']
    : ['인문언어', '사회과학', '과학기술', '예술체육', '융복합'])
    .map((label) => ({ label, credits: '선택 영역' }))

  const cultureCriteria = isNursing && year >= 2022
    ? [{ label: '인성', credits: '3학점', note: '실무·실기 면제' }]
    : isNursing && year >= 2018
      ? [{ label: 'KU인성', credits: year <= 2019 ? '4학점' : '3학점', note: 'KU소양 면제' }]
      : isMedicine && year >= 2022
        ? [
            { label: '인성', credits: '3학점' },
            { label: '실무 또는 실기', credits: '2학점' },
          ]
        : year >= 2022
          ? [
              { label: '인성', credits: '3학점', note: '성신의대학생활지도 필수' },
              { label: '실무', credits: '4학점', note: '취업전략수립및역량개발1 필수' },
              { label: '실기', credits: '2학점' },
            ]
          : year >= 2020
            ? [
                { label: 'KU인성', credits: '3학점', note: '나 1 · 나·우리·함께 2' },
                { label: '실무소양', credits: '4학점', note: '취업전략수립및역량개발1 필수' },
                { label: '실기소양', credits: '2학점' },
              ]
            : year >= 2018
              ? [
                  { label: 'KU인성', credits: '4학점', note: '나 2 · 나·우리·함께 2' },
                  { label: '실무소양', credits: '4학점', note: '취업전략수립및역량개발1 필수' },
                  { label: '실기소양', credits: '2학점' },
                ]
              : [
                  { label: 'KU인성', credits: '3학점', note: '대학생활지도1·2 포함' },
                  { label: '실무소양', credits: '6학점', note: 'IT활용·직업과창의' },
                  { label: '계열핵심', credits: '6~9학점' },
                ]

  const basicCriteriaWithCourses = basicCriteria.map((criterion) => ({
    ...criterion,
    requiredGroups: basicRequired.filter((group) => {
      if (criterion.label === '글쓰기') return group.label.includes('글쓰기')
      if (criterion.label === '발표와토론') return group.label.includes('발표와토론')
      if (criterion.label === '의사소통') return group.label.includes('글쓰기') || group.label.includes('발표와토론')
      if (criterion.label === '외국어기초' || criterion.label === '국제화') return group.label === 'KUGEP1'
      if (criterion.label === '과학기초' || criterion.label === '과학사고') {
        return group.label === '컴퓨팅적사고' || group.label.startsWith('대학기초')
      }
      if (criterion.label === 'AI/데이터') return group.label.includes('AI/데이터')
      return false
    }),
  }))
  const cultureCriteriaWithCourses = cultureCriteria.map((criterion) => ({
    ...criterion,
    requiredGroups: cultureRequired.filter((group) => {
      if (criterion.label.includes('인성')) return group.label.includes('성신의대학생활지도')
      if (criterion.label.includes('실무')) return group.label.startsWith('취업전략')
      return false
    }),
  }))

  return [
    {
      key: 'basic',
      label: '기초교양',
      description: basicDescription,
      highlights: ['외국인 학생은 외국인 전용 글쓰기1·2로 대체'],
      requiredGroups: basicRequired,
      criteria: basicCriteriaWithCourses,
    },
    {
      key: 'advanced',
      label: '심화교양',
      description: year <= 2021 ? '5개 영역 중 4개 영역 이상' : '6개 영역 중 4개 영역 이상 (영역당 1학점 이상)',
      highlights: [year <= 2021 ? '5개 영역 중 4개 이상' : '6개 영역 중 4개 이상'],
      requiredGroups: [],
      criteria: advancedCriteria.map((criterion) => ({ ...criterion, requiredGroups: [] })),
    },
    {
      key: 'culture',
      label: '소양',
      description: cultureDescription,
      highlights: year === 2017 ? ['계열핵심 6~9학점'] : [],
      requiredGroups: cultureRequired,
      criteria: cultureCriteriaWithCourses,
    },
  ]
}
