import React from 'react'
import { motion, Variants, useInView as fmInView } from 'framer-motion'

// ── Shared Variants ──────────────────────────────────────────────────────────

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
  }
}

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }
}

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
}

export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
}

export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } }
}

export const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } }
}

export const cardHoverVariants = {
  rest: { y: 0, boxShadow: '0 2px 8px rgba(10,15,30,0.06)' },
  hover: { y: -4, boxShadow: '0 16px 48px rgba(10,15,30,0.12)', transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }
}

// ── Scroll-triggered Reveal ─────────────────────────────────────────────────

interface RevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'left' | 'right' | 'none'
  once?: boolean
}

export function Reveal({ children, className, delay = 0, direction = 'up', once = true }: RevealProps) {
  const ref = React.useRef(null)
  const inView = fmInView(ref, { once, margin: '-60px 0px' })

  const variants: Record<string, Variants> = {
    up: fadeUpVariants,
    left: slideLeftVariants,
    right: slideRightVariants,
    none: fadeInVariants,
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants[direction]}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

// ── Stagger Group ─────────────────────────────────────────────────────────────

export function StaggerGroup({ children, className, fast }: { children: React.ReactNode; className?: string; fast?: boolean }) {
  const ref = React.useRef(null)
  const inView = fmInView(ref, { once: true, margin: '-40px 0px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={fast ? staggerFast : staggerContainer}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

// ── StaggerItem ────────────────────────────────────────────────────────────

export function StaggerItem({ children, className, direction = 'up' }: { children: React.ReactNode; className?: string; direction?: 'up' | 'left' | 'right' | 'none' }) {
  const v: Record<string, Variants> = { up: fadeUpVariants, left: slideLeftVariants, right: slideRightVariants, none: fadeInVariants }
  return <motion.div className={className} variants={v[direction]}>{children}</motion.div>
}

// ── Floating blob decoration ──────────────────────────────────────────────

export function FloatingBlob({ className }: { className?: string }) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -18, 0], x: [0, 8, 0], scale: [1, 1.04, 1], rotate: [0, 3, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// ── Animated number counter ───────────────────────────────────────────────

export function CountUp({ value, suffix = '', prefix = '', className }: { value: number; suffix?: string; prefix?: string; className?: string }) {
  const ref = React.useRef(null)
  const inView = fmInView(ref, { once: true })
  const [displayed, setDisplayed] = React.useState(0)

  React.useEffect(() => {
    if (!inView) return
    let startTime: number
    const duration = 1200
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, value])

  return (
    <span ref={ref} className={className}>
      {prefix}{displayed.toLocaleString()}{suffix}
    </span>
  )
}

// ── Magnetic button wrapper ───────────────────────────────────────────────

export function MagneticWrap({ children, className, strength = 0.3 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const [pos, setPos] = React.useState({ x: 0, y: 0 })
  const ref = React.useRef<HTMLDivElement>(null)

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setPos({ x: (e.clientX - cx) * strength, y: (e.clientY - cy) * strength })
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  )
}

// ── Ticker / marquee ─────────────────────────────────────────────────────

export function Ticker({ items, speed = 25 }: { items: React.ReactNode[]; speed?: number }) {
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden relative">
      <motion.div
        className="flex gap-6 w-max"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ repeat: Infinity, duration: speed, ease: 'linear' }}
      >
        {doubled.map((item, i) => <div key={i}>{item}</div>)}
      </motion.div>
    </div>
  )
}

// ── Page transition wrapper ───────────────────────────────────────────────

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
