import type { AppTab } from '../shared/types/navigation'
import AssistantSection from '../features/chat/components/AssistantSection'
import HomeSection from '../features/home/components/HomeSection'
import MapSection from '../features/map/components/MapSection'
import ScheduleSection from '../features/schedule/components/ScheduleSection'
import TaxiPartySection from '../features/taxi/components/TaxiPartySection'

type MainSectionProps = {
  activeTab: AppTab
  userId: number
  userName: string
  department: string
  studentNumber: string
  profileImage: string | null
  onOpenProfile: () => void
  suggestedQuestion: string
  assistantPrompt: string | null
  onOpenAssistant: (prompt: string) => void
  onOpenTaxi: () => void
  onCloseTaxi: () => void
}

function MainSection({
  activeTab,
  userId,
  userName,
  department,
  studentNumber,
  profileImage,
  onOpenProfile,
  suggestedQuestion,
  assistantPrompt,
  onOpenAssistant,
  onOpenTaxi,
  onCloseTaxi,
}: MainSectionProps) {
  return (
    <main className={`app-section app-section-${activeTab}`}>
      {activeTab === 'home' && (
        <HomeSection
          userId={userId}
          userName={userName}
          profileImage={profileImage}
          onOpenProfile={onOpenProfile}
          suggestedQuestion={suggestedQuestion}
          onOpenAssistant={onOpenAssistant}
          onOpenTaxi={onOpenTaxi}
        />
      )}
      {activeTab === 'taxi' && <TaxiPartySection onBack={onCloseTaxi} />}
      {activeTab === 'schedule' && (
        <ScheduleSection userId={userId} department={department} studentNumber={studentNumber} />
      )}
      {activeTab === 'assistant' && (
        <AssistantSection
          initialPrompt={assistantPrompt}
          userName={userName}
          department={department}
          studentNumber={studentNumber}
        />
      )}
      {activeTab === 'map' && <MapSection />}
    </main>
  )
}

export default MainSection
