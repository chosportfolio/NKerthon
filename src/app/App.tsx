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
import '../styles/app.css'
import '../features/auth/auth.css'
import '../features/chat/chat.css'
import '../shared/profile.css'
import '../features/schedule/schedule.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(() => !getSavedAuthToken())
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const [suggestedQuestion] = useState(getRandomHomePrompt)
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null)

  useEffect(() => {
    const token = getSavedAuthToken()

    if (!token) return

    getCurrentUser(token)
      .then(({ user: savedUser }) => setUser(savedUser))
      .catch(() => clearAuthToken())
      .finally(() => setAuthReady(true))
  }, [])

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
