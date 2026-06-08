import React, { useState, useEffect } from 'react'
import { FileText, Search, Download } from 'lucide-react'
import { auditApi } from '@/api/client'
import { Reveal, EmptyState, Spinner } from '@/components/ui/shared'
import { formatDistanceToNow } from 'date-fns'

const ACTION_COLORS: Record<string, string> = {
  login: 'var(--green)', logout: 'var(--fg-4)', register: 'var(--blue)',
  voice_create: 'var(--blue)', voice_delete: 'var(--red)',
  clone_start: '#7c3aed', clone_complete: 'var(--green)',
  generation_start: '#7c3aed', generation_complete: 'var(--green)',
  detection_start: 'var(--amber)', detection_complete: 'var(--green)',
  plan_change: 'var(--amber)', api_key_create: 'var(--blue)', api_key_revoke: 'var(--red)',
  export_create: 'var(--blue)', evidence_export: 'var(--amber)',
  profile_update: 'var(--fg-3)', settings_change: 'var(--fg-3)',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const PAGE_SIZE = 50

  const load = async (p: number) => {
    setLoading(true)
    auditApi.list({ page: p, page_size: PAGE_SIZE }).then(d => {
      setLogs(d.logs || [])
      setTotal(d.total || 0)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(page) }, [page])

  const filtered = search
    ? logs.filter(l => JSON.stringify(l).toLowerCase().includes(search.toLowerCase()))
    : logs

  const exportLogs = () => {
    const csv = ['timestamp,action,resource_type,resource_id,ip_address,status',
      ...filtered.map((l: any) => `${l.created_at},${l.action},${l.resource_type || ''},${l.resource_id || ''},${l.ip_address || ''},${l.status}`)
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'audit_logs.csv'; a.click()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.025em' }}>
              <FileText size={22} style={{ color: 'var(--fg-3)' }} /> Audit Logs
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>{total.toLocaleString()} total events</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-5)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter logs…" className="input" style={{ paddingLeft: 30, width: 180 }} />
            </div>
            <button onClick={exportLogs} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={22} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={FileText} title="No audit logs" description="User actions and system events will be logged here." />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>IP Address</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log: any) => {
                    const color = ACTION_COLORS[log.action] || 'var(--fg-4)'
                    return (
                      <tr key={log.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-2)', fontFamily: 'monospace' }}>{log.action}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--fg-4)', fontFamily: 'monospace' }}>
                          {log.resource_type ? `${log.resource_type}` : '—'}
                          {log.resource_id && <span style={{ color: 'var(--fg-5)' }}>  {log.resource_id?.slice(0, 8)}…</span>}
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--fg-4)', fontFamily: 'monospace' }}>{log.ip_address || '—'}</td>
                        <td>
                          <span className={`badge ${log.status === 'success' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10.5 }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--fg-5)', whiteSpace: 'nowrap' }}>
                          {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {total > PAGE_SIZE && (
                <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'center', gap: 8, borderTop: '1px solid var(--border-2)' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">Previous</button>
                  <span style={{ fontSize: 13, color: 'var(--fg-4)', padding: '6px 12px' }}>Page {page}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE} className="btn btn-secondary btn-sm">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </Reveal>
    </div>
  )
}
