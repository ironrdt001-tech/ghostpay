import type { RecentPerson } from '../lib/types'

interface RecentPeopleProps {
  people: RecentPerson[]
  selectedRecipient: string
  onSelectPerson: (handle: string) => void
}

export function RecentPeople({ people, selectedRecipient, onSelectPerson }: RecentPeopleProps) {
  if (people.length === 0) return null

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
        Recent people · 1-tap fill
      </div>
      <div className="recent-people-strip no-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', overflowX: 'auto', paddingBottom: '4px' }}>
        {people.map(person => {
          const isSelected = selectedRecipient.trim().replace(/^@+/, '').toLowerCase() === person.label.toLowerCase()
          return (
            <button
              key={person.handle}
              type="button"
              onClick={() => onSelectPerson(person.handle)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                minWidth: '60px',
              }}
              title={`Fill ${person.handle}`}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-inset)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 500,
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                }}
              >
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt={person.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  person.label.charAt(0).toUpperCase()
                )}
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: '11px',
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)',
                  maxWidth: '68px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                @{person.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
