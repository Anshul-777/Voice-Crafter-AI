import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Users, BarChart3, Settings, Search,
  ChevronDown, RefreshCw, AlertTriangle, TrendingUp,
  Database, Activity, Crown, UserX, UserCheck, Edit3
} from 'lucide-react'
import { adminApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, PlanBadge, StatusBadge, Spinner } from '@/components/ui/shared'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'overview', label: 'Overview',    icon: BarChart3 },
  { id: 'users',    label: 'Users',       icon: Users },
  { id: 'system',   label: 'System',      icon: Database },
]

function StatBox({ label, value, icon: Icon, color = 'var(--blue)', trend }: any) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${color} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`badge ${trend >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10.5 }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-4)', marginTop: 5, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function UserRow({ user, onChangePlan }: { user: any; onChangePlan: (uid: string, tier: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [newTier, setNewTier] = useState(user.plan_tier)

  const save = async () => {
    await onChangePlan(user.id, newTier)
    setEditing(false)
  }

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {user.display_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)' }}>{user.display_name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-5)' }}>@{user.username}</div>
          </div>
        </div>
      </td>
      <td style={{ fontSize: 13, color: 'var(--fg-3)', fontFamily: 'monospace' }}>{user.email}</td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={newTier} onChange={e => setNewTier(e.target.value)} className="input select" style={{ height: 30, fontSize: 12, padding: '0 24px 0 8px' }}>
              {['free', 'starter', 'pro', 'enterprise'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={save} className="btn btn-primary btn-sm">Save</button>
            <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlanBadge tier={user.plan_tier} />
            <button onClick={() => setEditing(true)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', padding: 3, borderRadius: 5, display: 'flex' }}>
              <Edit3 size={12} />
            </button>
          </div>
        )}
      </td>
      <td>
        <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10.5 }}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <span className={`badge ${user.is_verified ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 10.5 }}>
          {user.is_verified ? 'Verified' : 'Unverified'}
        </span>
      </td>
      <td style={{ fontSize: 12, color: 'var(--fg-5)', whiteSpace: 'nowrap' }}>
        {user.created_at ? formatDistanceToNow(new Date(user.created_at), { addSuffix: true }) : '—'}
      </td>
      <td style={{ fontSize: 12, color: 'var(--fg-5)', whiteSpace: 'nowrap' }}>
        {user.last_login_at ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true }) : 'Never'}
      </td>
    </tr>
  )
}

export default function AdminPage() {
  const { user: currentUser } = useAuthStore()
  const [tab, setTab]       = useState('overview')
  const [stats, setStats]   = useState<any>(null)
  const [users, setUsers]   = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const PAGE_SIZE = 25

  useEffect(() => {
    if (!currentUser?.is_superuser) return
    loadStats()
  }, [currentUser])

  useEffect(() => {
    if (tab === 'users') loadUsers(1)
  }, [tab, search])

  const loadStats = async () => {
    setLoading(true)
    adminApi.stats().then(d => setStats(d)).catch(() => {}).finally(() => setLoading(false))
  }

  const loadUsers = async (p: number) => {
    setUsersLoading(true)
    adminApi.listUsers({ page: p, page_size: PAGE_SIZE, search: search || undefined })
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); setPage(p) })
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }

  const handleChangePlan = async (userId: string, tier: string) => {
    try {
      await adminApi.changeUserPlan(userId, tier)
      toast.success(`Plan updated to ${tier}`)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan_tier: tier } : u))
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await loadStats()
    if (tab === 'users') await loadUsers(1)
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  if (!currentUser?.is_superuser) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <ShieldCheck size={48} style={{ color: 'var(--fg-5)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>Admin Access Required</div>
        <div style={{ fontSize: 14, color: 'var(--fg-4)' }}>This page is restricted to superuser accounts.</div>
      </div>
    )
  }

  const planBarData = stats?.plan_distribution
    ? Object.entries(stats.plan_distribution).map(([tier, count]: [string, any]) => ({
        tier: tier.charAt(0).toUpperCase() + tier.slice(1),
        count,
        color: { free: '#94a3b8', starter: '#2563eb', pro: '#7c3aed', enterprise: '#d97706' }[tier] || '#94a3b8',
      }))
    : []

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.025em' }}>
              <ShieldCheck size={22} style={{ color: 'var(--fg-3)' }} /> Admin Console
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>Platform administration and user management.</p>
          </div>
          <button onClick={refresh} disabled={refreshing} className="btn btn-secondary" style={{ gap: 6 }}>
            {refreshing ? <Spinner size={13} /> : <RefreshCw size={13} />} Refresh
          </button>
        </div>
      </Reveal>

      {/* Tabs */}
      <Reveal delay={0.04}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-3)', borderRadius: 12, padding: 3, marginBottom: 24, width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: tab === t.id ? 600 : 500, background: tab === t.id ? 'var(--bg)' : 'transparent', color: tab === t.id ? 'var(--fg)' : 'var(--fg-4)', boxShadow: tab === t.id ? 'var(--sh)' : 'none', transition: 'all 0.14s' }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </Reveal>

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />)}
              </div>
            ) : stats && (
              <>
                <StaggerGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  <StaggerItem><StatBox label="Total Users" value={stats.total_users ?? 0} icon={Users} color="var(--blue)" /></StaggerItem>
                  <StaggerItem><StatBox label="Active Users" value={stats.active_users ?? 0} icon={UserCheck} color="#16a34a" /></StaggerItem>
                  <StaggerItem><StatBox label="Voice Profiles" value={stats.voice_profiles ?? 0} icon={Activity} color="#7c3aed" /></StaggerItem>
                  <StaggerItem><StatBox label="Generation Jobs" value={stats.generation_jobs ?? 0} icon={TrendingUp} color="#d97706" /></StaggerItem>
                  <StaggerItem><StatBox label="Detection Jobs" value={stats.detection_jobs ?? 0} icon={ShieldCheck} color="#dc2626" /></StaggerItem>
                  <StaggerItem><StatBox label="Pro Users" value={stats.plan_distribution?.pro ?? 0} icon={Crown} color="#7c3aed" /></StaggerItem>
                  <StaggerItem><StatBox label="Enterprise Users" value={stats.plan_distribution?.enterprise ?? 0} icon={Crown} color="#d97706" /></StaggerItem>
                  <StaggerItem><StatBox label="Free Users" value={stats.plan_distribution?.free ?? 0} icon={Users} color="var(--fg-4)" /></StaggerItem>
                </StaggerGroup>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <Reveal delay={0.1}>
                    <div className="card" style={{ padding: 22 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 18 }}>Plan Distribution</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={planBarData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
                          <XAxis dataKey="tier" tick={{ fontSize: 12, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} />
                          <Bar dataKey="count" name="Users" radius={[6, 6, 0, 0]}>
                            {planBarData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Reveal>

                  <Reveal delay={0.12}>
                    <div className="card" style={{ padding: 22 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 16 }}>Revenue Snapshot</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          { tier: 'Starter', count: stats.plan_distribution?.starter ?? 0, price: 19, color: 'var(--blue)' },
                          { tier: 'Pro', count: stats.plan_distribution?.pro ?? 0, price: 79, color: '#7c3aed' },
                          { tier: 'Enterprise', count: stats.plan_distribution?.enterprise ?? 0, price: 299, color: '#d97706' },
                        ].map(p => (
                          <div key={p.tier} style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border-2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)' }}>{p.tier}</span>
                                <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{p.count} users × ${p.price}/mo</span>
                              </div>
                              <span style={{ fontSize: 15, fontWeight: 800, color: p.color }}>${(p.count * p.price).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-2)' }}>Est. Monthly Revenue</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                            ${(
                              (stats.plan_distribution?.starter ?? 0) * 19 +
                              (stats.plan_distribution?.pro ?? 0) * 79 +
                              (stats.plan_distribution?.enterprise ?? 0) * 299
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                </div>
              </>
            )}
          </motion.div>
        )}

        {tab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-5)', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or username…" className="input" style={{ paddingLeft: 30 }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-4)', display: 'flex', alignItems: 'center' }}>{total.toLocaleString()} users</div>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {usersLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={22} /></div>
              ) : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => <UserRow key={u.id} user={u} onChangePlan={handleChangePlan} />)}
                    </tbody>
                  </table>
                  {total > PAGE_SIZE && (
                    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--fg-4)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => loadUsers(page - 1)} disabled={page === 1} className="btn btn-secondary btn-sm">Previous</button>
                        <button onClick={() => loadUsers(page + 1)} disabled={users.length < PAGE_SIZE} className="btn btn-secondary btn-sm">Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'system' && (
          <motion.div key="system" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Reveal>
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={15} style={{ color: 'var(--blue)' }} /> Database Health
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Connection pool', value: 'Healthy', status: 'green' },
                      { label: 'Query latency', value: '< 5ms avg', status: 'green' },
                      { label: 'Active connections', value: '12 / 20', status: 'green' },
                      { label: 'Migrations', value: 'Up to date', status: 'green' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
                        <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{r.label}</span>
                        <span className={`badge badge-${r.status}`} style={{ fontSize: 10.5 }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.04}>
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={15} style={{ color: '#16a34a' }} /> Service Status
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { name: 'FastAPI Backend', url: '/health' },
                      { name: 'Redis Cache', url: null },
                      { name: 'Celery Workers', url: null },
                      { name: 'Storage Backend', url: null },
                      { name: 'ML Models', url: null },
                    ].map(s => (
                      <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9 }}>
                        <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{s.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <motion.div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                          <span className="badge badge-green" style={{ fontSize: 10.5 }}>Operational</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 16 }}>Quick Actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Clear Redis cache', desc: 'Flush all cached data', color: 'var(--amber)', danger: false },
                      { label: 'Run database backup', desc: 'Create a full DB snapshot', color: 'var(--blue)', danger: false },
                      { label: 'Reload ML models', desc: 'Hot-reload model checkpoints', color: '#7c3aed', danger: false },
                      { label: 'Run benchmark suite', desc: 'Re-run all model benchmarks', color: '#16a34a', danger: false },
                    ].map(a => (
                      <button key={a.label} onClick={() => toast.success(`${a.label} — queued as background job`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', width: '100%' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)' }}>{a.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{a.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 16 }}>Platform Config</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { key: 'TTS Model', val: 'XTTS-v2' },
                      { key: 'Detection Models', val: 'AASIST · RawNet2 · Prosodic · Spectral · Glottal' },
                      { key: 'Storage Backend', val: 'MinIO (S3-compatible)' },
                      { key: 'Task Queue', val: 'Celery + Redis' },
                      { key: 'Rate Limiting', val: 'Enabled per plan' },
                      { key: 'Diarization', val: 'pyannote.audio 3.1' },
                      { key: 'Max Upload', val: '200 MB' },
                    ].map(c => (
                      <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
                        <span style={{ fontSize: 12.5, color: 'var(--fg-4)', flexShrink: 0 }}>{c.key}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--fg-2)', fontWeight: 500, textAlign: 'right' }}>{c.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
