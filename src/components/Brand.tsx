import { Link } from 'react-router-dom'
import { ShieldIcon } from './Icons'

interface BrandProps {
  to?: string
}

export function Brand({ to = '/' }: BrandProps) {
  return (
    <Link to={to} className="brand-link" aria-label="GhostPay home">
      <span className="brand-mark">
        <ShieldIcon size={16} strokeWidth={2} />
      </span>
      <span>ghostpay</span>
    </Link>
  )
}
