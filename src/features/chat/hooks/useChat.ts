import { useState } from 'react'
import { fallbackText, welcomeText } from '../constants/chatCopy'
import { menuData } from '../data/menuData'
import type { Language, Menu, Message } from '../types/chat'
import { getCurrentTime, getRandomDelay } from '../utils/chatUtils'

const normalize = (text: string) => text.toLowerCase().replace(/\s/g, '')

const createWelcomeMessage = (language: Language): Message => ({
  type: 'menu',
  text: welcomeText[language],
  isUser: false,
  time: getCurrentTime(),
})

const createBotMessage = (menu: Menu | undefined, language: Language): Message => {
  if (!menu) {
    return {
      type: 'text',
      text: fallbackText[language],
      isUser: false,
      time: getCurrentTime(),
    }
  }

  return {
    type: 'link',
    text: menu.botText[language],
    description: menu.description?.[language],
    buttons: menu.buttons?.map((button) => ({
      text: button.text[language],
      url: button.url,
    })),
    isUser: false,
    time: getCurrentTime(),
  }
}

export function useChat() {
  const [language, setLanguage] = useState<Language>('ko')
  const [messages, setMessages] = useState<Message[]>(() => [createWelcomeMessage('ko')])

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage)
    setMessages([createWelcomeMessage(nextLanguage)])
  }

  const queueResponse = (userText: string, menu?: Menu) => {
    const now = getCurrentTime()

    setMessages((current) => [
      ...current,
      { type: 'text', text: userText, isUser: true, time: now },
      { type: 'text', text: '', isUser: false, time: now, isLoading: true },
    ])

    setTimeout(() => {
      setMessages((current) => [
        ...current.filter((message) => !message.isLoading),
        createBotMessage(menu, language),
      ])
    }, getRandomDelay())
  }

  const sendMessage = (text: string) => {
    const trimmedText = text.trim()
    if (!trimmedText) return

    const normalizedInput = normalize(trimmedText)
    const matchedMenu = menuData.find((menu) =>
      menu.keywords.some((keyword) => normalizedInput.includes(normalize(keyword))),
    )

    queueResponse(trimmedText, matchedMenu)
  }

  const selectMenu = (menu: Menu) => {
    queueResponse(menu.userText[language], menu)
  }

  return {
    language,
    messages,
    changeLanguage,
    sendMessage,
    selectMenu,
  }
}
