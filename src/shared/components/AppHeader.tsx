import { useEffect, useRef, useState } from 'react'

const formatCurrentDate = () =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

type AppHeaderProps = {
  userName: string
  profileImage: string | null
  onOpenProfile: () => void
  notifications?: HeaderNotification[]
}

export type HeaderNotification = {
  id: string
  title: string
  body: string
  meta: string
  kind: 'course' | 'calendar'
}

function AppHeader({ userName, profileImage, onOpenProfile, notifications = [] }: AppHeaderProps) {
  const [formattedDate, setFormattedDate] = useState(formatCurrentDate)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [readSignature, setReadSignature] = useState('')
  const actionsRef = useRef<HTMLDivElement>(null)
  const notificationSignature = notifications.map((notification) => notification.id).join('|')
  const hasUnread = Boolean(notificationSignature && notificationSignature !== readSignature)

  useEffect(() => {
    const updateDate = () => setFormattedDate(formatCurrentDate())
    const timer = window.setInterval(updateDate, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notificationOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setNotificationOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationOpen])

  const toggleNotifications = () => {
    const next = !notificationOpen
    setNotificationOpen(next)
    if (next) setReadSignature(notificationSignature)
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div>
          <p>{formattedDate} · 글로컬캠퍼스</p>
          <h1>{userName}님, 안녕하세요</h1>
        </div>
        <div className="app-header-actions" ref={actionsRef}>
          <button
            className="notification-button"
            type="button"
            aria-label="알림 보기"
            aria-expanded={notificationOpen}
            aria-controls="home-notification-panel"
            onClick={toggleNotifications}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
            {hasUnread && <span aria-hidden="true"></span>}
          </button>
          <button
            className="profile-button"
            type="button"
            aria-label="내 프로필 보기"
            onClick={onOpenProfile}
          >
            {profileImage ? (
              <img src={profileImage} alt="" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
              </svg>
            )}
          </button>
          {notificationOpen && (
            <section className="notification-panel" id="home-notification-panel" aria-label="알림 목록">
              <header>
                <div><strong>알림</strong><span>{notifications.length}개의 새 소식</span></div>
                <button type="button" aria-label="알림 닫기" onClick={() => setNotificationOpen(false)}>×</button>
              </header>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <span aria-hidden="true">✓</span>
                    <strong>새로운 알림이 없어요</strong>
                    <small>새 소식이 생기면 여기서 알려드릴게요.</small>
                  </div>
                ) : notifications.map((notification) => (
                  <article className={`notification-item is-${notification.kind}`} key={notification.id}>
                    <span className="notification-item-icon" aria-hidden="true">
                      {notification.kind === 'course' ? '⌚' : '▣'}
                    </span>
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                      <small>{notification.meta}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
