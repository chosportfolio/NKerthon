import type { ScheduleCourse } from '../types/schedule'

export const liberalAreaOptions: Record<string, string[]> = {
  기초: ['글쓰기', '발표와토론', '외국어기초', '인문기초', '과학기초', 'AI/데이터', '의사소통', '국제화', '인문사고', '과학사고'],
  심화: ['글로벌언어', '인간과문화', '인간과사회', '과학과기술', '예술과체육', '융복합', '인문언어', '사회과학', '과학기술', '예술체육'],
  소양: ['인성', '실무', '실기', 'KU인성', '실무소양', '실기소양', '계열핵심'],
}

const normalize = (value: string) => value.replace(/[\s·()]/g, '').toLowerCase()

export function inferLiberalArea(course: Pick<ScheduleCourse, 'name' | 'liberalArea'>) {
  if (course.liberalArea) return course.liberalArea
  const name = normalize(course.name)

  if (['창의글쓰기', '실용글쓰기', '성찰글쓰기', '미디어글쓰기', '글쓰기', '외국인전용글쓰기1', '외국인전용글쓰기2'].some((item) => name === normalize(item))) return '글쓰기'
  if (['비판적사고와토론', '공감적소통과발표', '열린사고와실용적말하기', '협력적사고와토의', '발표와토론'].some((item) => name === normalize(item))) return '발표와토론'
  if (name.includes('kugep')) return '외국어기초'
  if (['컴퓨팅적사고', '데이터리터러시', 'ai리터러시', '빅데이터의기초', '프로그래밍의기초'].some((item) => name === normalize(item))) return 'AI/데이터'
  if (name.startsWith(normalize('대학기초'))) return '과학기초'
  if (name.includes(normalize('성신의대학생활지도'))) return '인성'
  if (name.startsWith(normalize('취업전략수립'))) return '실무'
  return ''
}

export function criterionAreaKeys(label: string) {
  const mappings: Record<string, string[]> = {
    글쓰기: ['글쓰기', '의사소통'],
    발표와토론: ['발표와토론', '의사소통'],
    외국어기초: ['외국어기초', '국제화'],
    국제화: ['외국어기초', '국제화'],
    인문기초: ['인문기초', '인문사고'],
    인문사고: ['인문기초', '인문사고'],
    과학기초: ['과학기초', '과학사고'],
    과학사고: ['과학기초', '과학사고'],
    의사소통: ['의사소통', '글쓰기', '발표와토론'],
    'AI/데이터': ['AI/데이터'],
    KU인성: ['KU인성', '인성'],
    인성: ['KU인성', '인성'],
    실무소양: ['실무소양', '실무'],
    실무: ['실무소양', '실무'],
    실기소양: ['실기소양', '실기'],
    실기: ['실기소양', '실기'],
    '실무 또는 실기': ['실무소양', '실무', '실기소양', '실기'],
  }
  return mappings[label] ?? [label]
}
