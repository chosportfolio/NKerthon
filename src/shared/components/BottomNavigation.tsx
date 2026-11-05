import type { AppTab } from '../types/navigation'

type BottomNavigationProps = {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <footer className="bottom-navigation">
      <div className="bottom-navigation-inner">
        <button className={`nav-item${activeTab === 'home' ? ' is-active' : ''}`} type="button" onClick={() => onTabChange('home')} aria-label="홈">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z" />
            </svg>
          </span>
          <span>홈</span>
        </button>

        <button className={`nav-item${activeTab === 'schedule' ? ' is-active' : ''}`} type="button" onClick={() => onTabChange('schedule')} aria-label="시간표">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <path d="M8 2v4M16 2v4M3 9h18M9 9v12M15 9v12" />
            </svg>
          </span>
          <span>시간표</span>
        </button>

        <button className={`nav-item${activeTab === 'taxi' ? ' is-active' : ''}`} type="button" onClick={() => onTabChange('taxi')} aria-label="택시팟">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 11 2-5h10l2 5M4 11h16v7H4zM7 18v2M17 18v2M7.5 14.5h.01M16.5 14.5h.01" />
            </svg>
          </span>
          <span>택시팟</span>
        </button>

        <button className={`nav-item nav-chatbot${activeTab === 'assistant' ? ' is-active' : ''}`} type="button" onClick={() => onTabChange('assistant')} aria-label="AI 선배">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 5.5h12A2.5 2.5 0 0 1 20.5 8v7a2.5 2.5 0 0 1-2.5 2.5h-5.4L8 20.5v-3H6A2.5 2.5 0 0 1 3.5 15V8A2.5 2.5 0 0 1 6 5.5Z" />
              <path d="m8 11 1.2 1.2L11.5 10M14 12h3" />
            </svg>
          </span>
          <span>AI 선배</span>
        </button>

        <button className={`nav-item${activeTab === 'map' ? ' is-active' : ''}`} type="button" onClick={() => onTabChange('map')} aria-label="지도">
          <span className="nav-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
              <path d="M9 3v15M15 6v15" />
            </svg>
          </span>
          <span>지도</span>
        </button>
      </div>
    </footer>
  )
}

export default BottomNavigation
