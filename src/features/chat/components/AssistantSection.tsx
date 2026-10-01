import ChatContainer from './ChatContainer'
import ChatInput from './ChatInput'
import { useChat } from '../hooks/useChat'

type AssistantSectionProps = {
  initialPrompt: string | null
}

function AssistantSection({ initialPrompt }: AssistantSectionProps) {
  const { language, messages, sendMessage, selectMenu } = useChat()

  return (
    <section className="assistant-view" aria-label="AI 선배">
      <ChatContainer
        messages={messages}
        language={language}
        onMenuSelect={selectMenu}
      />
      <ChatInput
        language={language}
        onSend={sendMessage}
        initialValue={initialPrompt ?? ''}
        autoSend={Boolean(initialPrompt)}
      />
    </section>
  )
}

export default AssistantSection
