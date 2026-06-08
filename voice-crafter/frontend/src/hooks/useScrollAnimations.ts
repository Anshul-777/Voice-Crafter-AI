import { useEffect, useRef, useState } from 'react'

// ── useInView — triggers when element enters viewport ──────────────────────
export function useInView(threshold = 0.15, once = true) {
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once])

  return { ref, inView }
}

// ── useScrollProgress — page scroll progress 0→1 ──────────────────────────
export function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement
      setProgress(scrollTop / (scrollHeight - clientHeight))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return progress
}

// ── useParallax — simple parallax offset based on scroll ──────────────────
export function useParallax(speed = 0.3) {
  const ref = useRef<HTMLElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const center = rect.top + rect.height / 2 - window.innerHeight / 2
      setOffset(center * speed)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])

  return { ref, offset }
}

// ── useMagneticHover — magnetic cursor pull effect ────────────────────────
export function useMagneticHover(strength = 0.25) {
  const ref = useRef<HTMLElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const onMouseMove = (e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setPos({ x: (e.clientX - cx) * strength, y: (e.clientY - cy) * strength })
  }

  const onMouseLeave = () => setPos({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mousemove', onMouseMove as any)
    el.addEventListener('mouseleave', onMouseLeave)
    return () => {
      el.removeEventListener('mousemove', onMouseMove as any)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return { ref, style: { transform: `translate(${pos.x}px, ${pos.y}px)`, transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)' } }
}

// ── useCountUp — animated number counter ─────────────────────────────────
export function useCountUp(target: number, duration = 1200, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // easeOut
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return value
}
