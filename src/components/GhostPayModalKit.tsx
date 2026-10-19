// PROTECTED - owner approval required to edit.
import './ghostpay-modal.css'
import './ghostpay-modal.lock.css'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { CloseIcon, ShareIcon, DownloadIcon } from './Icons'

export interface GPModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  disabled?: boolean
  children: ReactNode
}

export function GPModal({
  title,
  subtitle,
  onClose,
  disabled = false,
  children,
}: GPModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !disabled) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, disabled])

  return (
    <div
      className="gp-overlay"
      role="presentation"
      onClick={() => {
        if (!disabled) onClose()
      }}
    >
      <div
        className="gp-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gp-header">
          <div>
            <h2 className="gp-title">{title}</h2>
            {subtitle ? <p className="gp-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="gp-close"
            onClick={() => {
              if (!disabled) onClose()
            }}
            disabled={disabled}
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface GPAmountFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (v: string) => void
  optional?: boolean
  placeholder?: string
  hint?: string
  disabled?: boolean
  label?: string
}

export function GPAmountField({
  value,
  onChange,
  optional = false,
  placeholder = 'Enter amount',
  hint,
  disabled = false,
  label = 'Amount (₹)',
  ...rest
}: GPAmountFieldProps) {
  return (
    <div className="gp-section">
      <label className="gp-label">
        {label}
        {optional ? <span className="gp-optional">(optional)</span> : null}
      </label>
      <div className="gp-field">
        <span className="gp-field-prefix">₹</span>
        <input
          className="gp-input"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          {...rest}
        />
      </div>
      {hint ? <p className="gp-hint">{hint}</p> : null}
    </div>
  )
}

export interface GPChipsProps {
  options?: number[]
  amount: string | number
  onPick: (n: number) => void
  disabled?: boolean
}

export function GPChips({
  options = [500, 1000, 2000, 5000],
  amount,
  onPick,
  disabled = false,
}: GPChipsProps) {
  return (
    <div className="gp-chips">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className="gp-chip"
          data-selected={Number(amount) === n}
          onClick={() => onPick(n)}
        >
          +₹{n.toLocaleString('en-IN')}
        </button>
      ))}
    </div>
  )
}

export interface GPButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
}

export function GPButton({
  variant = 'primary',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: GPButtonProps) {
  const combinedClass = `gp-btn gp-btn-${variant}${className ? ` ${className}` : ''}`
  return (
    <button type={type} {...rest} className={combinedClass}>
      {icon}
      {children}
    </button>
  )
}

export const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
)

export { ShareIcon, DownloadIcon }
