import { useEffect, useRef, useState } from "react";
import type { Language } from "../types/chat";

type Props = {
  onSend: (text: string) => void;
  language: Language;
  initialValue?: string;
  autoSend?: boolean;
};

const placeholderText = {
  ko: "질문을 입력하세요.",
  en: "Type your question.",
  zh: "请输入问题。",
};

export default function ChatInput({
  onSend,
  language,
  initialValue = "",
  autoSend = false,
}: Props) {
  const [input, setInput] = useState(initialValue);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const hasAutoSent = useRef(false);
  const hasInput = input.trim().length > 0;

  useEffect(() => {
    if (!autoSend || !initialValue.trim() || hasAutoSent.current) return;

    hasAutoSent.current = true;
    setInput(initialValue);
    setIsAutoSubmitting(true);
    const timer = window.setTimeout(() => {
      onSend(initialValue.trim());
      setInput("");
      setIsAutoSubmitting(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [autoSend, initialValue, onSend]);

  const handleSend = () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) return;

    onSend(trimmedInput);
    setInput("");
  };

  return (
    <div className="chat-composer">
      <div className="composer-inner">
        <form
          className={`composer-form${hasInput ? " has-input" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <label className="sr-only" htmlFor="chat-question">
            {placeholderText[language]}
          </label>
        <input
          id="chat-question"
          type="text"
          placeholder={placeholderText[language]}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          readOnly={isAutoSubmitting}
        />

          {hasInput && (
            <button className="composer-send" type="submit" aria-label="질문 보내기">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m4 4 17 8-17 8 3-8-3-8Z" />
                <path d="M7 12h14" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
