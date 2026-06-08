import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mic2, Shield, Wand2, Globe, Activity, Zap, ArrowRight, Plus,
         TrendingUp, Clock, CheckCircle, AlertTriangle, Users } from 'lucide-react'
import { analyticsApi, hubApi } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { StatCard, ProgressBar, VerdictBadge, PlanBadge, Spinner } from '@/components/ui/index'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'

const QUICK_ACTIONS = [
  { icon: Mic2, label: 'Clone Voice', desc: 'Upload sample & clone', path: '/clone', color: 'from-brand-500 to-brand-600' },
  { icon: Wand2, label: 'Generate Speech', desc: 'Text to expressive voice', path: '/generate', color: 'from-violet-500 to-accent-600' },
  { icon: Shield, label: 'Detect Deepfake', desc: 'Upload file for analysis', path: '/detection', color: 'from-red-500 to-orange-500' },
  { icon: Activity, label: 'Live Detection', desc: 'Real-time microphone', path: '/detection/live', color: 'from-green-500 to-emerald-600' },
  { icon: Globe, label: 'Voice Hub', desc: 'Browse community voices', path: '/hub', color: 'from-cyan-500 to-blue-600' },
  { icon: Plus, label: 'New Voice', desc: 'Create voice profile', path: '/voices', color: 'from-amber-500 to-yellow-500' },
]

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [hubStats, setHubStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.overview().catch(() => null),
      analyticsApi.timeline(14).catch(() => ({ timeline: [] })),
      hubApi.stats().catch(() => null),
    ]).then(([ov, tl, hs]) => {
      setOverview(ov)
      setTimeline(tl?.timeline || [])
      setHubStats(hs)
    }).finally(() => setLoading(false))
  }, [])

  const planLimits = overview?.usage || {}

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-800 text-surface-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.display_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-surface-500 text-sm mt-1">Here's what's happening with your Voice-Crafter workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge tier={user?.plan_tier} />
          <Link to="/billing" className="btn-outline btn-sm">Upgrade Plan</Link>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h2 className="text-sm font-700 text-surface-700 uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {QUICK_ACTIONS.map((a, i) => (
            <motion.button key={a.path} onClick={() => navigate(a.path)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card-hover p-4 text-left group cursor-pointer">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform`}>
                <a.icon size={18} className="text-white" />
              </div>
              <div className="text-sm font-700 text-surface-800">{a.label}</div>
              <div className="text-xs text-surface-500 mt-0.5">{a.desc}</div>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* Stats Grid */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <h2 className="text-sm font-700 text-surface-700 uppercase tracking-wide mb-4">Overview</h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0,1,2,3].map(i => <div key={i} className="card p-5 h-28 shimmer rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Mic2} label="Voice Profiles" value={overview?.totals?.voice_profiles ?? 0} color="text-brand-600" bg="bg-brand-50" />
            <StatCard icon={Wand2} label="Generations" value={overview?.totals?.generation_jobs ?? 0} color="text-violet-600" bg="bg-violet-50" />
            <StatCard icon={Shield} label="Detections Run" value={overview?.totals?.detection_jobs ?? 0} color="text-red-600" bg="bg-red-50" />
            <StatCard icon={AlertTriangle} label="Synthetic Found" value={overview?.totals?.synthetic_detected ?? 0} color="text-orange-600" bg="bg-orange-50" />
          </div>
        )}
      </motion.section>

      {/* Main content row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-700 text-surface-900">Activity — Last 14 days</h3>
            <Link to="/analytics" className="text-xs text-brand-600 font-600 hover:text-brand-700 flex items-center gap-1">
              Full analytics <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="h-40 shimmer rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="detGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="generations" name="Generations" stroke="#8B5CF6" fill="url(#genGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="detections" name="Detections" stroke="#ef4444" fill="url(#detGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Usage & Plan */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-700 text-surface-900">Usage this month</h3>
            <PlanBadge tier={user?.plan_tier} />
          </div>

          {loading ? (
            <div className="space-y-4">{[0,1,2,3].map(i => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
          ) : (
            <div className="space-y-5">
              {Object.entries(planLimits).map(([key, val]: [string, any]) => {
                if (!val || typeof val !== 'object') return null
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                const used = Math.round(val.used || 0)
                const limit = val.limit
                const isUnlimited = val.unlimited
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-600 text-surface-700">{label}</span>
                      <span className="text-surface-500">{isUnlimited ? '∞' : `${used} / ${limit}`}</span>
                    </div>
                    {!isUnlimited && (
                      <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                        <div className={clsx('h-full rounded-full transition-all duration-700',
                          val.percentage > 85 ? 'bg-danger-500' : val.percentage > 65 ? 'bg-warning-500' : 'bg-brand-500')}
                          style={{ width: `${Math.min(100, val.percentage)}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {user?.plan_tier === 'free' && (
            <div className="mt-5 p-3 bg-brand-50 border border-brand-100 rounded-xl">
              <div className="text-xs font-700 text-brand-700 mb-1">🚀 Unlock more with Starter</div>
              <div className="text-xs text-brand-600 mb-3">10x more voice profiles, streaming, API access and more.</div>
              <Link to="/billing" className="btn-primary btn-sm w-full text-center block text-xs py-2">Upgrade — $19/mo</Link>
            </div>
          )}
        </motion.div>
      </div>

      {/* Community / Hub stats */}
      {hubStats && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="grid grid-cols-3 gap-4">
          {[
            { icon: Mic2, label: 'Public Voices', value: hubStats.public_voices?.toLocaleString() },
            { icon: Users, label: 'Active Users', value: hubStats.active_users?.toLocaleString() },
            { icon: Activity, label: 'Total Plays', value: hubStats.total_plays?.toLocaleString() },
          ].map(s => (
            <div key={s.label} className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center">
                <s.icon size={18} className="text-surface-600" />
              </div>
              <div>
                <div className="text-xl font-800 text-surface-900">{s.value}</div>
                <div className="text-xs text-surface-500 font-500">{s.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
