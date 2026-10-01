import { useEffect, useState } from 'react'

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
}

function AppHeader({ userName, profileImage, onOpenProfile }: AppHeaderProps) {
  const [formattedDate, setFormattedDate] = useState(formatCurrentDate)

  useEffect(() => {
    const updateDate = () => setFormattedDate(formatCurrentDate())
    const timer = window.setInterval(updateDate, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div>
          <p>{formattedDate} · 글로컬캠퍼스</p>
          <h1>{userName}님, 안녕하세요</h1>
        </div>
        <div className="app-header-actions">
          <button className="notification-button" type="button" aria-label="알림 보기">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
            <span aria-hidden="true"></span>
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
        </div>
      </div>
    </header>
  )
}

export default AppHeader
