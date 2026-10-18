import { ShieldIcon, ArrowOutgoingIcon, QrScanIcon, ActivityIcon, UserIcon } from './Icons'

interface MobileBottomNavProps {
  activeTab: 'home' | 'send' | 'activity'
  onSelectTab: (tab: 'home' | 'send' | 'activity') => void
  onOpenQr: () => void
  onOpenProfile: () => void
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenQr,
  onOpenProfile,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-nav-bar" aria-label="Mobile navigation">
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onSelectTab('home')}
      >
        <ShieldIcon size={20} strokeWidth={activeTab === 'home' ? 2 : 1.75} />
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'send' ? 'active' : ''}`}
        onClick={() => onSelectTab('send')}
      >
        <ArrowOutgoingIcon size={20} strokeWidth={activeTab === 'send' ? 2 : 1.75} />
        <span>Send</span>
      </button>

      <button
        type="button"
        className="mobile-nav-item"
        onClick={onOpenQr}
      >
        <QrScanIcon size={20} strokeWidth={1.75} />
        <span>My QR</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'activity' ? 'active' : ''}`}
        onClick={() => onSelectTab('activity')}
      >
        <ActivityIcon size={20} strokeWidth={activeTab === 'activity' ? 2 : 1.75} />
        <span>Activity</span>
      </button>

      <button
        type="button"
        className="mobile-nav-item"
        onClick={onOpenProfile}
      >
        <UserIcon size={20} strokeWidth={1.75} />
        <span>Profile</span>
      </button>
    </nav>
  )
}
