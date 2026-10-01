import { useCallback, useRef, useState } from 'react'
import { askChatbot, ChatbotUnavailableError } from '../api/chatApi'
import { fallbackText } from '../constants/chatCopy'
import { menuData } from '../data/menuData'
import type { ChatItem, ChatLanguage, ChatTurn, TimetableCourse } from '../types/assistant'
import { getCurrentTime } from '../utils/chatUtils'

const BUBBLE_DELAY_MS = 380
const OFFLINE_SOURCE_KINDS = new Set(['catalog', 'timetable'])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const normalize = (text: string) => text.toLowerCase().replace(/\s/g, '')
let idCounter = 0
const newId = () => `m${Date.now()}-${idCounter++}`

/** 챗봇 서버가 꺼져 있을 때: 기존 키워드 메뉴로 안내 */
function keywordFallback(question: string, language: ChatLanguage): ChatItem {
  const normalized = normalize(question)
  const menu = menuData.find((item) => item.keywords.some((keyword) => normalized.includes(normalize(keyword))))
  if (!menu) {
    return { id: newId(), kind: 'bot', text: fallbackText[language], time: getCurrentTime() }
  }
  const description = menu.description?.[language]
  return {
    id: newId(),
    kind: 'bot',
    text: description ? `${menu.botText[language]}\n\n${description}` : menu.botText[language],
    time: getCurrentTime(),
    links: menu.buttons?.map((button) => ({ text: button.text[language], url: button.url })),
  }
}

/** getTimetable: 질문할 때마다 앱 시간표에서 이번 학기 수업을 새로 읽어 함께 보냄 */
export function useAssistantChat(language: ChatLanguage = 'ko', getTimetable?: () => TimetableCourse[]) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [pending, setPending] = useState(false)
  const turnsRef = useRef<ChatTurn[]>([])
  // '새 대화'를 누르면 진행 중인 응답을 버리기 위한 번호.
  // 화면이 사라질 때는 올리지 않는다 — 개발 모드(StrictMode)가 화면을 한 번 뗐다 붙이면서
  // 홈에서 넘어온 첫 질문의 응답까지 버려 답이 안 나오는 문제가 있었다.
  const sessionRef = useRef(0)

  const reset = useCallback(() => {
    sessionRef.current += 1
    turnsRef.current = []
    setItems([])
    setPending(false)
  }, [])

  const send = useCallback(async (rawText: string) => {
    const question = rawText.trim()
    if (!question || pending) return

    const session = sessionRef.current
    const alive = () => session === sessionRef.current
    setPending(true)
    setItems((current) => [
      ...current.filter((item) => item.kind !== 'error'),
      { id: newId(), kind: 'user', text: question, time: getCurrentTime() },
    ])

    try {
      const result = await askChatbot(question, turnsRef.current, language, getTimetable?.() ?? [])
      if (!alive()) return

      for (const [index, bubble] of result.bubbles.entries()) {
        if (index > 0) await sleep(BUBBLE_DELAY_MS)
        if (!alive()) return
        setItems((current) => [...current, { id: newId(), kind: 'bot', text: bubble, time: getCurrentTime() }])
      }

      // 링크가 없는 자료 중 강의시간표·내 시간표는 앱 안의 데이터라 카드로 보여 준다
      const linked = result.sources.filter((source) => source.url || OFFLINE_SOURCE_KINDS.has(source.kind ?? ''))
      if (linked.length > 0) {
        await sleep(BUBBLE_DELAY_MS)
        if (!alive()) return
        setItems((current) => [...current, { id: newId(), kind: 'sources', sources: linked }])
      }

      // 실제 답변에만 평가 버튼 (되묻기·오류·키워드 안내에는 없음)
      const { answerId, autoFlag } = result
      if (answerId) {
        setItems((current) => [...current, { id: newId(), kind: 'feedback', answerId, autoFlag }])
      }

      turnsRef.current = [
        ...turnsRef.current,
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: result.answer },
      ].slice(-6)
    } catch (error) {
      if (!alive()) return
      if (error instanceof ChatbotUnavailableError) {
        setItems((current) => [...current, keywordFallback(question, language)])
      } else {
        const message = error instanceof Error ? error.message : '답변을 만들지 못했어요.'
        setItems((current) => [...current, { id: newId(), kind: 'error', text: message, retryText: question }])
      }
    } finally {
      if (alive()) setPending(false)
    }
  }, [getTimetable, language, pending])

  const retry = useCallback((text: string) => {
    setItems((current) => {
      const withoutError = current.filter((item) => item.kind !== 'error')
      const last = withoutError.at(-1)
      return last?.kind === 'user' && last.text === text ? withoutError.slice(0, -1) : withoutError
    })
    void send(text)
  }, [send])

  return { items, pending, send, retry, reset }
}
