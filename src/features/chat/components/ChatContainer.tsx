import { useEffect, useRef, useState } from "react";

import MessageBubble from "./MessageBubble";
import MenuGrid from "./MenuGrid";

import type { Language, Menu, Message } from "../types/chat";
import { getMenuPages } from "../data/menuData";

type Props = {
  messages: Message[];
  language: Language;
  onMenuSelect: (menu: Menu) => void;
};

export default function ChatContainer({
  messages,
  language,
  onMenuSelect,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const menuPages = getMenuPages();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <section className="chat-container">
      <div className="chat-inner">
        {messages.map((message, index) => (
          <div key={index}>
            <MessageBubble {...message} />

            {index === 0 && (
              <>
                <MenuGrid
                  menus={menuPages[currentPage] ?? []}
                  language={language}
                  onMenuClick={onMenuSelect}
                />

                <div className="dot-container">
                  {menuPages.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={
                        currentPage === index ? "dot active-dot" : "dot"
                      }
                      onClick={() => setCurrentPage(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </section>
  );
}
