import { useState } from 'react'
import { SendGlyph } from './AssistantIcons'

type Props = {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

function ChatComposer({ onSend, disabled = false, placeholder = 'AI 선배에게 물어보세요', autoFocus = false }: Props) {
  const [value, setValue] = useState('')
  const canSend = value.trim().length > 0 && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <form
      className="kubi-composer"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className="sr-only" htmlFor="kubi-question">{placeholder}</label>
      <input
        id="kubi-question"
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={500}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
      />
      <button className="kubi-send" type="submit" disabled={!canSend} aria-label="질문 보내기">
        <SendGlyph />
      </button>
    </form>
  )
}

export default ChatComposer
