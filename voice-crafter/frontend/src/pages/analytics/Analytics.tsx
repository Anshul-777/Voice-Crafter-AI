import React, { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { BarChart3, Wand2, Shield, Mic2, TrendingUp, Calendar } from 'lucide-react'
import { analyticsApi, detectionApi } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, StatCard, CountUp, Spinner } from '@/components/ui/shared'

export default function Analytics() {
  const [overview, setOverview] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [detStats, setDetStats] = useState<any>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsApi.overview().catch(() => null),
      analyticsApi.timeline(days).catch(() => ({ timeline: [] })),
      detectionApi.stats().catch(() => null),
    ]).then(([ov, tl, det]) => {
      setOverview(ov); setTimeline(tl?.timeline || []); setDetStats(det)
    }).finally(() => setLoading(false))
  }, [days])

  const verdictData = detStats?.verdict_distribution
    ? Object.entries(detStats.verdict_distribution).map(([k, v]: any) => ({
        name: k.replace(/_/g, ' '), value: v,
        color: k === 'authentic' ? '#16a34a' : k.includes('synthetic') ? '#dc2626' : '#d97706',
      }))
    : []

  const PERIOD_OPTIONS = [7, 14, 30, 90]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart3 size={22} style={{ color: 'var(--fg-3)' }} /> Analytics
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>Usage metrics, activity trends, and detection statistics.</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIOD_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${days === d ? 'var(--blue)' : 'var(--border)'}`,
                background: days === d ? 'var(--blue-soft)' : 'var(--bg)', color: days === d ? 'var(--blue)' : 'var(--fg-3)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
              }}>{d}d</button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Stat cards */}
      <StaggerGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Voice Profiles', value: overview?.totals?.voice_profiles ?? 0, icon: Mic2, color: 'var(--blue)' },
          { label: 'Generations', value: overview?.totals?.generation_jobs ?? 0, icon: Wand2, color: 'var(--violet)' },
          { label: 'Detections Run', value: overview?.totals?.detection_jobs ?? 0, icon: Shield, color: '#dc2626' },
          { label: 'Synthetic Found', value: overview?.totals?.synthetic_detected ?? 0, icon: TrendingUp, color: 'var(--amber)' },
        ].map((s, i) => (
          <StaggerItem key={s.label}>
            {loading ? <div className="skeleton" style={{ height: 92, borderRadius: 16 }} /> : (
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${s.color} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={17} style={{ color: s.color }} />
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.03em' }}>
                  <CountUp to={s.value} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-4)', marginTop: 3 }}>{s.label}</div>
              </div>
            )}
          </StaggerItem>
        ))}
      </StaggerGroup>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
        <Reveal>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 20 }}>Activity — last {days} days</div>
            {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    {[{ id: 'gen', c: '#7c3aed' }, { id: 'det', c: '#dc2626' }].map(g => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={g.c} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={g.c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
                  <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, boxShadow: 'var(--sh-md)' }} />
                  <Area type="monotone" dataKey="generations" name="Generations" stroke="#7c3aed" fill="url(#gen)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="detections" name="Detections" stroke="#dc2626" fill="url(#det)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              {[{ c: '#7c3aed', l: 'Generations' }, { c: '#dc2626', l: 'Detections' }].map(leg => (
                <div key={leg.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-4)' }}>
                  <div style={{ width: 10, height: 3, borderRadius: 99, background: leg.c }} />{leg.l}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 20 }}>Detection Verdicts</div>
            {loading || verdictData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--fg-5)', fontSize: 13 }}>No detection data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={verdictData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={42} strokeWidth={0}>
                      {verdictData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {verdictData.map((d: any) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <span style={{ fontSize: 12.5, color: 'var(--fg-3)', textTransform: 'capitalize' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>

      {/* Usage bars */}
      {overview?.usage && (
        <Reveal delay={0.08}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 20 }}>Monthly Quota Usage</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              {Object.entries(overview.usage).map(([key, val]: [string, any]) => {
                if (!val || typeof val !== 'object') return null
                const pct = val.unlimited ? 0 : Math.min(100, (val.used / Math.max(val.limit, 1)) * 100)
                const barColor = pct > 85 ? 'var(--red)' : pct > 65 ? 'var(--amber)' : 'var(--blue)'
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                        {val.unlimited ? '∞ Unlimited' : `${Math.round(val.used).toLocaleString()} / ${val.limit.toLocaleString()}`}
                      </span>
                    </div>
                    {!val.unlimited && (
                      <div className="progress">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  )
}
