import './ghostpay-modal.css'
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
  label?: string
}

export function GPAmountField({
  value,
  onChange,
  disabled = false,
  label = 'Amount (₹)',
  placeholder = '0',
  ...rest
}: GPAmountFieldProps) {
  return (
    <div className="gp-section">
      <label className="gp-label">{label}</label>
      <div className="gp-field">
        <span className="gp-field-prefix">₹</span>
        <input
          type="text"
          inputMode="decimal"
          className="gp-input"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          {...rest}
        />
      </div>
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

export { ShareIcon, DownloadIcon }
