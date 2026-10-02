import kuChatAvatar from "../../../assets/ku_chat_avatar.png";
import type { Message } from "../types/chat";

export default function MessageBubble({
  type,
  text,
  description,
  buttons,
  isUser,
  time,
  isLoading,
}: Message) {
  return (
    <div className={isUser ? "message-row user-row" : "message-row bot-row"}>
      {!isUser && (
        <img
          src={kuChatAvatar}
          alt="쿠비 프로필"
          className="profile"
        />
      )}

      <div
        className={
          isUser
            ? "message-content user-content"
            : "message-content bot-content"
        }
      >
        <div
          className={
            isUser
              ? "message-bubble user-bubble"
              : "message-bubble bot-bubble"
          }
        >
          {isLoading ? (
            <div className="typing-loader">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : (
            <>
              <p>{text}</p>

              {description && (
                <p className="message-description">
                  {description}
                </p>
              )}

              {type === "link" && buttons && buttons.length > 0 && (
                <div className="link-buttons">
                  {buttons.map((button) => (
                    <a
                      key={button.text}
                      href={button.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-button"
                    >
                      {button.text}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!isLoading && (
          <span className="message-time">
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
