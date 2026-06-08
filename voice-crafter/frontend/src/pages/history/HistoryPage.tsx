// ─── History Page ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { History, Wand2, Shield, Zap, ExternalLink, Search } from 'lucide-react'
import { historyApi } from '@/api/client'
import { Reveal, StatusBadge, VerdictBadge, EmptyState, Spinner } from '@/components/ui/shared'
import { formatDistanceToNow } from 'date-fns'

export function HistoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [jobType, setJobType] = useState('')

  useEffect(() => {
    setLoading(true)
    historyApi.list({ page_size: 50, job_type: jobType || undefined })
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [jobType])

  const filtered = filter
    ? items.filter(i => JSON.stringify(i).toLowerCase().includes(filter.toLowerCase()))
    : items

  const ICON_MAP: Record<string, any> = { generation: Wand2, detection: Shield, clone: Zap }
  const COLOR_MAP: Record<string, string> = { generation: '#7c3aed', detection: '#dc2626', clone: 'var(--blue)' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.025em' }}>
            <History size={22} style={{ color: 'var(--fg-3)' }} /> History
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-5)', pointerEvents: 'none' }} />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" className="input" style={{ paddingLeft: 30, width: 180 }} />
            </div>
            <select value={jobType} onChange={e => setJobType(e.target.value)} className="input select" style={{ width: 140 }}>
              <option value="">All types</option>
              <option value="generation">Generations</option>
              <option value="detection">Detections</option>
              <option value="clone">Clone Jobs</option>
            </select>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={22} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={History} title="No history yet" description="Your generation, detection, and cloning activity will appear here." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => {
                  const Icon = ICON_MAP[item.type] || History
                  const color = COLOR_MAP[item.type] || 'var(--fg-3)'
                  const link = item.type === 'detection' ? `/detection/${item.id}` : item.type === 'generation' ? `/history` : `/clone`
                  return (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${color} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={14} style={{ color }} />
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'capitalize' }}>{item.type}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--fg-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {item.summary || item.filename || item.verdict || item.mode || '—'}
                        </span>
                      </td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>
                        {item.verdict ? <VerdictBadge verdict={item.verdict} /> :
                         item.duration_seconds ? <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>{item.duration_seconds?.toFixed(1)}s audio</span> :
                         item.quality_score ? <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>{(item.quality_score * 100).toFixed(0)}% quality</span> : '—'}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>
                        {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : '—'}
                      </td>
                      <td>
                        <Link to={link} style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center' }}>
                          <ExternalLink size={13} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Reveal>
    </div>
  )
}

export default HistoryPage
