import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Check, Zap, Shield, Mic2, Wand2, BarChart3, Key, Star } from 'lucide-react'
import { plansApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, PlanBadge, UsageBar, Spinner } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const PLAN_FEATURES: Record<string, { icon: typeof Check; label: string }[]> = {
  free: [
    { icon: Mic2, label: '2 voice profiles' },
    { icon: Zap, label: '5 clone jobs / month' },
    { icon: Wand2, label: '10,000 characters / month' },
    { icon: Shield, label: '30 detection minutes / month' },
    { icon: BarChart3, label: '500 MB storage' },
  ],
  starter: [
    { icon: Mic2, label: '10 voice profiles' },
    { icon: Zap, label: '50 clone jobs / month' },
    { icon: Wand2, label: '100,000 characters / month' },
    { icon: Shield, label: '300 detection minutes / month' },
    { icon: BarChart3, label: '5 GB storage' },
    { icon: Key, label: 'API access (3 keys)' },
    { icon: Shield, label: 'Speaker diarization' },
    { icon: Star, label: 'Hub publishing' },
  ],
  pro: [
    { icon: Mic2, label: '50 voice profiles' },
    { icon: Zap, label: '500 clone jobs / month' },
    { icon: Wand2, label: '1,000,000 characters / month' },
    { icon: Shield, label: '3,000 detection minutes / month' },
    { icon: BarChart3, label: '50 GB storage' },
    { icon: Key, label: 'API access (10 keys)' },
    { icon: Zap, label: 'Fine-tuning mode' },
    { icon: Wand2, label: 'SSML support' },
    { icon: Shield, label: 'Priority queue' },
    { icon: Shield, label: 'Evidence export' },
  ],
  enterprise: [
    { icon: Check, label: 'Unlimited voice profiles' },
    { icon: Check, label: 'Unlimited clone jobs' },
    { icon: Check, label: 'Unlimited characters' },
    { icon: Check, label: 'Unlimited detection minutes' },
    { icon: Check, label: 'Unlimited storage' },
    { icon: Check, label: 'Unlimited API keys' },
    { icon: Check, label: 'Custom models' },
    { icon: Check, label: 'Dedicated support' },
    { icon: Check, label: 'SLA guarantee' },
  ],
}

const PLAN_META: Record<string, { name: string; monthly: number; yearly: number; color: string; accent: string }> = {
  free:       { name: 'Free',       monthly: 0,   yearly: 0,    color: 'var(--fg-3)', accent: 'var(--bg-3)' },
  starter:    { name: 'Starter',    monthly: 19,  yearly: 190,  color: 'var(--blue)', accent: 'var(--blue-soft)' },
  pro:        { name: 'Pro',        monthly: 79,  yearly: 790,  color: '#7c3aed',     accent: 'rgba(124,58,237,0.08)' },
  enterprise: { name: 'Enterprise', monthly: 299, yearly: 2990, color: '#d97706',     accent: 'rgba(217,119,6,0.08)' },
}

export default function Billing() {
  const { user, refreshUser } = useAuthStore()
  const [planData, setPlanData] = useState<any>(null)
  const [allPlans, setAllPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const currentTier = user?.plan_tier || 'free'

  useEffect(() => {
    Promise.all([
      plansApi.current().catch(() => null),
      plansApi.list().catch(() => ({ plans: [] })),
    ]).then(([curr, all]) => {
      setPlanData(curr)
      setAllPlans(all?.plans || [])
    }).finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async (tier: string) => {
    if (tier === currentTier) return
    setUpgrading(tier)
    try {
      const data = await plansApi.upgrade(tier, cycle)
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        toast.success(`Plan updated to ${tier}!`)
        await refreshUser()
        const curr = await plansApi.current()
        setPlanData(curr)
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setUpgrading(null)
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <Reveal>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={22} style={{ color: 'var(--fg-3)' }} /> Billing & Plans
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>Manage your subscription and usage quotas.</p>
        </div>
      </Reveal>

      {/* Current plan usage */}
      {planData?.usage && (
        <Reveal delay={0.04}>
          <div className="card" style={{ padding: 24, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Current Plan Usage</div>
              <PlanBadge tier={currentTier} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {Object.entries(planData.usage).map(([key, val]: [string, any]) => {
                if (!val || typeof val !== 'object') return null
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                return <UsageBar key={key} label={label} used={Math.round(val.used || 0)} limit={val.limit || 0} unlimited={val.unlimited} />
              })}
            </div>
          </div>
        </Reveal>
      )}

      {/* Billing cycle toggle */}
      <Reveal delay={0.06}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['monthly', 'yearly'] as const).map(c => (
              <button key={c} onClick={() => setCycle(c)}
                style={{ padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.14s', background: cycle === c ? 'var(--bg)' : 'transparent', color: cycle === c ? 'var(--fg)' : 'var(--fg-4)', boxShadow: cycle === c ? 'var(--sh)' : 'none' }}>
                {c === 'monthly' ? 'Monthly' : 'Yearly'}
                {c === 'yearly' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginLeft: 6, background: 'rgba(22,163,74,0.1)', padding: '1px 6px', borderRadius: 99 }}>-17%</span>}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Plan cards */}
      <StaggerGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {(['free','starter','pro','enterprise'] as const).map((tier, i) => {
          const meta = PLAN_META[tier]
          const features = PLAN_FEATURES[tier] || []
          const isCurrent = currentTier === tier
          const price = cycle === 'yearly' ? Math.round(meta.yearly / 12) : meta.monthly
          const isLoading = upgrading === tier

          return (
            <StaggerItem key={tier}>
              <motion.div
                className={isCurrent ? 'card' : 'card-hover'}
                style={{
                  padding: 22, height: '100%', display: 'flex', flexDirection: 'column',
                  borderColor: isCurrent ? meta.color : undefined,
                  borderWidth: isCurrent ? 2 : 1,
                  position: 'relative', overflow: 'hidden',
                }}
                whileHover={!isCurrent ? { y: -2 } : {}}
              >
                {isCurrent && (
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <span className="badge badge-blue" style={{ fontSize: 10, fontWeight: 700 }}>Current</span>
                  </div>
                )}
                {tier === 'starter' && !isCurrent && (
                  <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 3, background: 'var(--blue)', borderRadius: '16px 16px 0 0' }} />
                )}

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginBottom: 10 }}>{meta.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: meta.color, letterSpacing: '-0.04em' }}>${price}</span>
                    <span style={{ fontSize: 13, color: 'var(--fg-4)' }}>/mo</span>
                  </div>
                  {cycle === 'yearly' && meta.yearly > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 2 }}>Billed ${meta.yearly}/year</div>
                  )}
                </div>

                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={isCurrent || isLoading}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 9, border: isCurrent ? `1px solid ${meta.color}` : '1px solid var(--border)',
                    background: isCurrent ? meta.accent : tier === 'starter' ? 'var(--blue)' : 'var(--bg-2)',
                    color: isCurrent ? meta.color : tier === 'starter' ? 'white' : 'var(--fg-2)',
                    fontSize: 13.5, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer',
                    transition: 'all 0.14s', marginBottom: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  {isLoading ? <Spinner size={14} /> : isCurrent ? 'Current plan' : tier === 'free' ? 'Downgrade' : 'Upgrade'}
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={10} style={{ color: meta.color }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </StaggerItem>
          )
        })}
      </StaggerGroup>

      <Reveal delay={0.12}>
        <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border-2)', fontSize: 13, color: 'var(--fg-4)', textAlign: 'center', lineHeight: 1.6 }}>
          All plans include SSL encryption, GDPR-compliant data handling, and 99.9% uptime SLA. Enterprise plans include custom billing and dedicated infrastructure.
          Questions? <a href="mailto:support@voicecrafter.ai" style={{ color: 'var(--blue)', fontWeight: 500 }}>Contact us</a>.
        </div>
      </Reveal>
    </div>
  )
}
