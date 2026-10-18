import { ShieldIcon, ArrowOutgoingIcon, QrScanIcon, ActivityIcon, UserIcon } from './Icons'
import { triggerHaptic } from '../lib/haptics'

interface MobileBottomNavProps {
  activeTab: 'home' | 'send' | 'activity'
  onSelectTab: (tab: 'home' | 'send' | 'activity') => void
  onOpenScan: () => void
  onOpenProfile: () => void
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenScan,
  onOpenProfile,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-nav-bar" aria-label="Mobile navigation">
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => {
          triggerHaptic()
          onSelectTab('home')
        }}
      >
        <ShieldIcon size={20} strokeWidth={activeTab === 'home' ? 2 : 1.75} />
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'send' ? 'active' : ''}`}
        onClick={() => {
          triggerHaptic()
          onSelectTab('send')
        }}
      >
        <ArrowOutgoingIcon size={20} strokeWidth={activeTab === 'send' ? 2 : 1.75} />
        <span>Send</span>
      </button>

      {/* Central Raised Floating Action Button (FAB) for Scan */}
      <div className="mobile-nav-fab-slot">
        <button
          type="button"
          className="mobile-nav-fab"
          onClick={() => {
            triggerHaptic()
            onOpenScan()
          }}
          aria-label="Scan QR to pay"
          title="Scan QR to pay"
        >
          <QrScanIcon size={24} strokeWidth={2.2} />
        </button>
        <span className="mobile-nav-fab-label">Scan</span>
      </div>

      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'activity' ? 'active' : ''}`}
        onClick={() => {
          triggerHaptic()
          onSelectTab('activity')
        }}
      >
        <ActivityIcon size={20} strokeWidth={activeTab === 'activity' ? 2 : 1.75} />
        <span>Activity</span>
      </button>

      <button
        type="button"
        className="mobile-nav-item"
        onClick={() => {
          triggerHaptic()
          onOpenProfile()
        }}
      >
        <UserIcon size={20} strokeWidth={1.75} />
        <span>Profile</span>
      </button>
    </nav>
  )
}
