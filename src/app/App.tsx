import { useEffect, useState } from 'react'
import AuthScreen from '../features/auth/components/AuthScreen'
import ProfileSidebar from '../shared/components/ProfileSidebar'
import BottomNavigation from '../shared/components/BottomNavigation'
import MainSection from './MainSection'
import { getRandomHomePrompt } from '../features/home/constants/homePrompts'
import {
  clearAuthToken,
  getCurrentUser,
  getSavedAuthToken,
  logout,
  updateProfileImage,
} from '../features/auth/api/authApi'
import type { User } from '../features/auth/types/auth'
import type { AppTab } from '../shared/types/navigation'
import { getGivenName } from '../shared/utils/name'
import { syncScheduleFromServer } from '../features/schedule/utils/scheduleStorage'
import '../styles/app.css'
import '../features/auth/auth.css'
import '../features/chat/chat.css'
import '../shared/profile.css'
import '../features/schedule/schedule.css'
import '../features/taxi/taxi.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(() => !getSavedAuthToken())
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const [suggestedQuestion] = useState(getRandomHomePrompt)
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null)

  useEffect(() => {
    const desktopMedia = window.matchMedia('(hover: hover) and (pointer: fine)')

    const updateDesktopScale = () => {
      if (!desktopMedia.matches) {
        document.documentElement.style.removeProperty('--desktop-app-scale')
        return
      }

      const widthScale = window.innerWidth / 560
      const heightScale = window.innerHeight / 860
      document.documentElement.style.setProperty(
        '--desktop-app-scale',
        String(Math.min(widthScale, heightScale)),
      )
    }

    updateDesktopScale()
    window.addEventListener('resize', updateDesktopScale)
    window.visualViewport?.addEventListener('resize', updateDesktopScale)
    desktopMedia.addEventListener('change', updateDesktopScale)

    return () => {
      window.removeEventListener('resize', updateDesktopScale)
      window.visualViewport?.removeEventListener('resize', updateDesktopScale)
      desktopMedia.removeEventListener('change', updateDesktopScale)
      document.documentElement.style.removeProperty('--desktop-app-scale')
    }
  }, [])

  useEffect(() => {
    const token = getSavedAuthToken()

    if (!token) return

    getCurrentUser(token)
      .then(({ user: savedUser }) => setUser(savedUser))
      .catch(() => clearAuthToken())
      .finally(() => setAuthReady(true))
  }, [])

  // 로그인하면 서버에 저장된 시간표를 받아 온다 (다른 PC에서 저장한 시간표도 보이도록)
  const userId = user?.id
  useEffect(() => {
    if (userId) void syncScheduleFromServer(userId)
  }, [userId])

  const openAssistantWithPrompt = (prompt: string) => {
    setAssistantPrompt(prompt)
    setActiveTab('assistant')
  }

  const changeTab = (tab: AppTab) => {
    if (tab === 'assistant') {
      setAssistantPrompt(null)
    }
    setActiveTab(tab)
  }

  const handleProfileImageChange = async (profileImage: string) => {
    const result = await updateProfileImage(profileImage)
    setUser(result.user)
  }

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      clearAuthToken()
      setProfileOpen(false)
      setActiveTab('home')
      setUser(null)
    }
  }

  if (!authReady) {
    return <div className="auth-loading">로그인 정보를 확인하고 있어요...</div>
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />
  }

  return (
    <div className="campus-app">
      <MainSection
        activeTab={activeTab}
        userId={user.id}
        userName={getGivenName(user.name)}
        department={user.department}
        studentNumber={user.studentNumber}
        profileImage={user.profileImage}
        onOpenProfile={() => setProfileOpen(true)}
        suggestedQuestion={suggestedQuestion}
        assistantPrompt={assistantPrompt}
        onOpenAssistant={openAssistantWithPrompt}
        onOpenTaxi={() => setActiveTab('taxi')}
        onCloseTaxi={() => setActiveTab('home')}
      />
      <BottomNavigation activeTab={activeTab} onTabChange={changeTab} />
      {profileOpen && (
        <ProfileSidebar
          user={user}
          onClose={() => setProfileOpen(false)}
          onLogout={handleLogout}
          onProfileImageChange={handleProfileImageChange}
        />
      )}
    </div>
  )
}

export default App
