import type { LocalizedText } from '../types/chat'

export const welcomeText: LocalizedText = {
  ko: `안녕하세요! 건국대학교 AI 챗봇 쿠비예요 😊
학사·장학·수업 정보가 궁금하다면
무엇이든 물어보세요!`,
  en: `Hello! I'm KUBI, Konkuk University's AI chatbot 😊
Ask me anything about academics, scholarships, classes, and campus life!`,
  zh: `你好！我是建国大学 AI 聊天机器人 KUBI 😊
如果你想了解学事、奖学金、课程和校园生活，
可以随时问我！`,
}

export const fallbackText: LocalizedText = {
  ko: '제가 질문을 잘 이해하지 못했어요 😥\n알고 싶은 내용을 조금 더 쉽고 짧게 말해주시면 다시 찾아볼게요 🙂',
  en: "Sorry, I couldn't understand your question 😥\nPlease ask again in a simpler way 🙂",
  zh: '抱歉，我没有理解你的问题 😥\n请用更简单的方式再问一次 🙂',
}
