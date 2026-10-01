export const homePrompts = [
  '중간고사 언제야?',
  '축제 언제야?',
  '행정실 번호 뭐야?',
  '국가장학금 신청 기간 알려줘',
  '오늘 학식 메뉴 알려줘',
  '수강신청 기간이 언제야?',
] as const

export const getRandomHomePrompt = () => {
  const randomIndex = Math.floor(Math.random() * homePrompts.length)
  return homePrompts[randomIndex]
}
