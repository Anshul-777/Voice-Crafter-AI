// Shared UI components
import React from 'react'
import { Bell } from 'lucide-react'
import clsx from 'clsx'

// ── NotificationBell ─────────────────────────────────────────────────────────
export function NotificationBell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative p-2 rounded-xl hover:bg-surface-100 text-surface-600 hover:text-surface-800 transition-all">
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-danger-500 text-white text-[10px] font-700 rounded-full flex items-center justify-center leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ── UserAvatar ───────────────────────────────────────────────────────────────
export function UserAvatar({ user, size = 'md' }: { user: any; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-lg', xl: 'w-16 h-16 text-xl' }
  const initials = user?.display_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt={user.display_name} className={clsx(sizes[size], 'rounded-full object-cover ring-2 ring-white flex-shrink-0')} />
  }
  return (
    <div className={clsx(sizes[size], 'rounded-full gradient-brand flex items-center justify-center text-white font-700 flex-shrink-0 ring-2 ring-white')}>
      {initials}
    </div>
  )
}

// ── PlanBadge ────────────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-surface-100 text-surface-500' },
  starter: { label: 'Starter', color: 'bg-blue-100 text-blue-700' },
  pro: { label: 'Pro', color: 'bg-violet-100 text-violet-700' },
  enterprise: { label: 'Enterprise', color: 'bg-amber-100 text-amber-700' },
}

export function PlanBadge({ tier }: { tier?: string }) {
  const cfg = PLAN_CONFIG[tier || 'free']
  return (
    <span className={clsx('inline-flex text-[10px] font-700 px-1.5 py-0.5 rounded-md uppercase tracking-wide', cfg.color)}>
      {cfg.label}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={clsx('animate-spin text-brand-500', className)} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-surface-400" />
      </div>
      <h3 className="text-base font-700 text-surface-800 mb-1">{title}</h3>
      <p className="text-sm text-surface-500 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, string> = {
  pending: 'bg-surface-100 text-surface-600',
  queued: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-success-500/10 text-success-600',
  failed: 'bg-danger-500/10 text-danger-600',
  cancelled: 'bg-surface-100 text-surface-500',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('badge', STATUS_CFG[status] || 'bg-surface-100 text-surface-600')}>
      {status === 'processing' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
      {status}
    </span>
  )
}

// ── VerdictBadge ──────────────────────────────────────────────────────────────
const VERDICT_CFG: Record<string, { label: string; cls: string }> = {
  authentic: { label: '✓ Authentic', cls: 'bg-success-500/10 text-success-600' },
  synthetic_tts: { label: '⚠ TTS Detected', cls: 'bg-danger-500/10 text-danger-600' },
  voice_conversion: { label: '⚠ Voice Converted', cls: 'bg-danger-500/10 text-danger-600' },
  partial_manipulation: { label: '⚠ Partial Manip.', cls: 'bg-warning-500/10 text-warning-600' },
  inconclusive: { label: '? Inconclusive', cls: 'bg-surface-100 text-surface-600' },
}

export function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null
  const cfg = VERDICT_CFG[verdict] || { label: verdict, cls: 'bg-surface-100 text-surface-600' }
  return <span className={clsx('badge font-700', cfg.cls)}>{cfg.label}</span>
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'bg-brand-500', label }: {
  value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between text-xs text-surface-500"><span>{label}</span><span>{Math.round(pct)}%</span></div>}
      <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, change, color = 'text-brand-600', bg = 'bg-brand-50' }: {
  icon: any; label: string; value: string | number; change?: string; color?: string; bg?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
          <Icon size={20} className={color} />
        </div>
        {change && <span className={clsx('text-xs font-600 px-2 py-0.5 rounded-full', parseFloat(change) >= 0 ? 'text-success-600 bg-success-500/10' : 'text-danger-600 bg-danger-500/10')}>{change}</span>}
      </div>
      <div className="text-2xl font-800 text-surface-900 tabular-nums">{value}</div>
      <div className="text-xs text-surface-500 mt-0.5 font-500">{label}</div>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; icon?: any }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
      {tabs.map(tab => {
        const Icon = tab.icon
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 text-sm font-600 rounded-lg transition-all duration-150',
              active === tab.id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
            {Icon && <Icon size={14} />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-2xl w-full', sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h3 className="font-700 text-surface-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-all">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default UserAvatar
