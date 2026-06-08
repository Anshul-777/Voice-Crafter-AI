import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic2, Wand2, Shield, Globe, BarChart3, CreditCard, History,
  Bell, FileText, Settings, ChevronRight, LogOut, Menu, X,
  Zap, Search, Plus, Activity, FlaskConical, Star, Gauge,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/authStore'
import { notificationsApi } from '@/api/client'

const NAV_SECTIONS = [
  {
    items: [{ label: 'Dashboard', icon: Gauge, path: '/dashboard' }],
  },
  {
    title: 'Create',
    items: [
      { label: 'My Voices', icon: Mic2, path: '/voices' },
      { label: 'Clone Voice', icon: Zap, path: '/clone', tag: 'AI' },
      { label: 'Generate TTS', icon: Wand2, path: '/generate' },
    ],
  },
  {
    title: 'Security',
    items: [
      { label: 'Detection Lab', icon: Shield, path: '/detection', tag: '5-Model' },
      { label: 'Live Detection', icon: Activity, path: '/detection/live' },
    ],
  },
  {
    title: 'Community',
    items: [{ label: 'Voice Hub', icon: Globe, path: '/hub' }],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', icon: BarChart3, path: '/analytics' },
      { label: 'History', icon: History, path: '/history' },
      { label: 'Quality Lab', icon: FlaskConical, path: '/quality' },
      { label: 'Benchmarks', icon: Star, path: '/benchmarks' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Billing', icon: CreditCard, path: '/billing' },
      { label: 'Audit Logs', icon: FileText, path: '/audit' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
]

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-500',
  starter: 'bg-brand-50 text-brand-700',
  pro: 'bg-violet-50 text-violet-700',
  enterprise: 'bg-amber-50 text-amber-700',
}

function Avatar({ user }: { user: any }) {
  const initials = user?.display_name?.split(' ').map((name: string) => name[0]).join('').toUpperCase().slice(0, 2) || '?'

  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white" />
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
      {initials}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    notificationsApi.list({ unread_only: true }).then((data) => setUnreadCount(data.unread_count || 0)).catch(() => {})
  }, [location.pathname])

  const planBadge = PLAN_BADGE[user?.plan_tier || 'free']

  const SidebarInner = () => (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-surface-200 px-4 py-5">
        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25"
          whileHover={{ scale: 1.08, rotate: -5 }}
          transition={{ duration: 0.25 }}
        >
          <Mic2 size={16} color="white" />
        </motion.div>
        {!collapsed && (
          <div>
            <div className="text-sm font-extrabold tracking-tight text-slate-900">Voice-Crafter</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Enterprise AI</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-2">
            {section.title && !collapsed && (
              <div className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">
                {section.title}
              </div>
            )}
            {section.title && collapsed && <div className="mx-3 my-2 h-px bg-surface-200" />}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path))

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={() => clsx(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-surface-50 hover:text-slate-900',
                  )}
                >
                  <Icon size={15} className={clsx('shrink-0 transition-colors', isActive ? 'text-brand-600' : 'text-slate-400')} />
                  {!collapsed && (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {(item as any).tag && (
                        <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-brand-700">
                          {(item as any).tag}
                        </span>
                      )}
                    </span>
                  )}
                  {isActive && <span className="absolute right-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-brand-600" />}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-surface-200 p-3">
        <button
          onClick={() => navigate('/profile')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-50"
        >
          <Avatar user={user} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{user?.display_name}</div>
              <div className={clsx('mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', planBadge)}>
                {user?.plan_tier} Plan
              </div>
            </div>
          )}
          {!collapsed && <ChevronRight size={13} className="text-slate-300" />}
        </button>
        {!collapsed && (
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={13} />
            Sign out
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 text-slate-900">
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="relative hidden shrink-0 overflow-hidden border-r border-surface-200 bg-white lg:flex lg:flex-col"
      >
        <SidebarInner />
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute bottom-28 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-surface-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={12} className="text-slate-400" />
          </motion.div>
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebar(false)}
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 z-50 h-full w-[280px] overflow-hidden border-r border-surface-200 bg-white lg:hidden"
            >
              <button
                onClick={() => setMobileSidebar(false)}
                aria-label="Close sidebar"
                title="Close sidebar"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-surface-200 bg-white text-slate-500"
              >
                <X size={16} />
              </button>
              <SidebarInner />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 shrink-0 items-center gap-3 border-b border-surface-200 bg-white px-4 sm:px-6">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-slate-600 lg:hidden"
            onClick={() => setMobileSidebar(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="relative max-w-md flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search voices, jobs, results…"
              className="input h-10 w-full border-surface-200 bg-surface-50 pl-10 text-sm focus:bg-white"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <motion.button
              onClick={() => navigate('/generate')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary hidden h-10 px-4 sm:inline-flex"
            >
              <Plus size={13} /> Generate
            </motion.button>

            <motion.button
              onClick={() => navigate('/notifications')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-white text-slate-500 transition-colors hover:bg-surface-50"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={17} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold leading-none text-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
