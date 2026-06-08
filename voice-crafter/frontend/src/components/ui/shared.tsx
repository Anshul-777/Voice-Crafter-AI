import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

/* ── Scroll-triggered fade-up reveal ── */
export function Reveal({
  children, className = '', delay = 0, direction = 'up', once = true,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'left' | 'right' | 'none'
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once, margin: '-48px 0px' })

  const initial = {
    up:    { opacity: 0, y: 20 },
    left:  { opacity: 0, x: -20 },
    right: { opacity: 0, x: 20 },
    none:  { opacity: 0 },
  }[direction]

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : initial}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}

/* ── Stagger container that reveals children in sequence ── */
export function StaggerGroup({
  children, className = '', delayStart = 0,
}: {
  children: React.ReactNode; className?: string; delayStart?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-32px 0px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: delayStart } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
      }}
    >
      {children}
    </motion.div>
  )
}

/* ── Animated count-up number ── */
export function CountUp({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    if (!inView) return
    let start: number
    const dur = 1000
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, to])
  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>
}

/* ── Ticker/marquee ── */
export function Ticker({ items, speed = 28 }: { items: React.ReactNode[]; speed?: number }) {
  const doubled = [...items, ...items]
  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <motion.div
        style={{ display: 'flex', gap: 0, width: 'max-content' }}
        animate={{ x: ['0%', '-50%'] }}
        transition={{ repeat: Infinity, duration: speed, ease: 'linear' }}
      >
        {doubled.map((item, i) => <div key={i}>{item}</div>)}
      </motion.div>
    </div>
  )
}

/* ── Live waveform bars ── */
export function WaveBars({
  color = 'var(--blue)', bars = 12, height = 32, active = true,
}: {
  color?: string; bars?: number; height?: number; active?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height }}>
      {Array.from({ length: bars }, (_, i) => (
        <motion.div
          key={i}
          style={{ width: 2, borderRadius: 99, background: color, originY: 1 }}
          animate={active ? { scaleY: [0.35, 1.1, 0.35] } : { scaleY: 0.35 }}
          transition={{ duration: 1 + (i % 4) * 0.18, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/* ── Page header ── */
export function PageHeader({
  icon: Icon, title, description, action,
}: {
  icon?: React.ComponentType<any>; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <Reveal>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--fg)',
            display: 'flex', alignItems: 'center', gap: 10,
            letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 4
          }}>
            {Icon && <Icon size={22} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />}
            {title}
          </h1>
          {description && <p style={{ fontSize: 13.5, color: 'var(--fg-4)', lineHeight: 1.5 }}>{description}</p>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </Reveal>
  )
}

/* ── Stat card ── */
export function StatCard({
  label, value, sub, icon: Icon, iconColor = 'var(--blue)', trend,
}: {
  label: string; value: string | number; sub?: string; icon?: React.ComponentType<any>; iconColor?: string; trend?: string
}) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        {Icon && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${iconColor} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} style={{ color: iconColor }} />
          </div>
        )}
        {trend && (
          <span className={`badge ${parseFloat(trend) >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11 }}>
            {parseFloat(trend) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(trend))}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-4)', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--fg-5)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/* ── Empty state ── */
export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<any>; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon size={24} style={{ color: 'var(--fg-5)' }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13.5, color: 'var(--fg-4)', maxWidth: 320, lineHeight: 1.5, marginBottom: 20 }}>{description}</div>}
      {action}
    </div>
  )
}

/* ── Status badge ── */
const STATUS_MAP: Record<string, { cls: string; dot: string }> = {
  pending:    { cls: 'badge-gray',  dot: 'var(--fg-5)' },
  queued:     { cls: 'badge-amber', dot: 'var(--amber)' },
  processing: { cls: 'badge-blue',  dot: 'var(--blue)' },
  completed:  { cls: 'badge-green', dot: 'var(--green)' },
  failed:     { cls: 'badge-red',   dot: 'var(--red)' },
  cancelled:  { cls: 'badge-gray',  dot: 'var(--fg-5)' },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { cls: 'badge-gray', dot: 'var(--fg-5)' }
  return (
    <span className={`badge ${cfg.cls}`}>
      <span className="dot" style={{ background: cfg.dot }} />
      {status}
    </span>
  )
}

/* ── Verdict badge ── */
const VERDICT_MAP: Record<string, { label: string; cls: string }> = {
  authentic:             { label: 'Authentic',           cls: 'badge-green' },
  synthetic_tts:         { label: 'TTS Detected',        cls: 'badge-red' },
  voice_conversion:      { label: 'Voice Converted',     cls: 'badge-red' },
  partial_manipulation:  { label: 'Partial Manip.',      cls: 'badge-amber' },
  inconclusive:          { label: 'Inconclusive',        cls: 'badge-gray' },
}

export function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null
  const cfg = VERDICT_MAP[verdict] ?? { label: verdict, cls: 'badge-gray' }
  return <span className={`badge ${cfg.cls}`} style={{ fontWeight: 700 }}>{cfg.label}</span>
}

/* ── Plan badge ── */
const PLAN_MAP: Record<string, { label: string; cls: string }> = {
  free:       { label: 'Free',       cls: 'badge-gray' },
  starter:    { label: 'Starter',    cls: 'badge-blue' },
  pro:        { label: 'Pro',        cls: 'badge-violet' },
  enterprise: { label: 'Enterprise', cls: 'badge-amber' },
}

export function PlanBadge({ tier }: { tier?: string }) {
  const cfg = PLAN_MAP[tier ?? 'free'] ?? PLAN_MAP.free
  return <span className={`badge ${cfg.cls}`} style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}>{cfg.label}</span>
}

/* ── Mini spinner ── */
export function Spinner({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ color }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity={0.2} />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* ── Progress usage bar ── */
export function UsageBar({
  label, used, limit, unit = '', unlimited = false,
}: {
  label: string; used: number; limit: number; unit?: string; unlimited?: boolean
}) {
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100)
  const color = pct > 85 ? 'var(--red)' : pct > 65 ? 'var(--amber)' : 'var(--blue)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--fg-4)', fontWeight: 500 }}>
          {unlimited ? '∞' : `${used.toLocaleString()} / ${limit.toLocaleString()} ${unit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  )
}

export default Reveal
