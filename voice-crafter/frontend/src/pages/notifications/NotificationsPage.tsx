import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { notificationsApi } from '@/api/client'
import { Reveal, EmptyState, Spinner } from '@/components/ui/shared'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const TYPE_COLORS: Record<string, string> = {
  clone_complete: 'var(--blue)', clone_failed: 'var(--red)',
  generation_complete: '#7c3aed', detection_alert: 'var(--red)',
  quota_warning: 'var(--amber)', quota_exceeded: 'var(--red)',
  plan_changed: 'var(--blue)', member_joined: 'var(--green)',
  system_alert: 'var(--amber)', new_follower: 'var(--green)',
  voice_liked: '#db2777', comment_received: 'var(--blue)',
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)

  const load = async () => {
    setLoading(true)
    notificationsApi.list({ page_size: 50 })
      .then(d => { setNotifs(d.notifications || []); setUnread(d.unread_count || 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
    toast.success('All marked as read')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.025em' }}>
            <Bell size={22} style={{ color: 'var(--fg-3)' }} /> Notifications
            {unread > 0 && <span className="badge badge-blue">{unread} new</span>}
          </h1>
          {unread > 0 && (
            <button onClick={markAllRead} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={22} /></div>
          ) : notifs.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up! Notifications about jobs, plans, and activity will appear here." />
          ) : (
            <AnimatePresence>
              {notifs.map((n, i) => {
                const color = TYPE_COLORS[n.type] || 'var(--fg-4)'
                return (
                  <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => !n.is_read && markRead(n.id)}
                    style={{ display: 'flex', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border-2)', cursor: n.is_read ? 'default' : 'pointer', background: n.is_read ? 'transparent' : 'rgba(37,99,235,0.02)', transition: 'background 0.15s' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bell size={16} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontSize: 13.5, fontWeight: n.is_read ? 500 : 700, color: 'var(--fg-2)', lineHeight: 1.4 }}>{n.title}</div>
                        {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--fg-4)', marginTop: 3, lineHeight: 1.5 }}>{n.message}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-5)', marginTop: 6 }}>
                        {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </Reveal>
    </div>
  )
}
