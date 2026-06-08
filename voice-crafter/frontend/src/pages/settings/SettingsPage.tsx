import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, User, Key, Bell, Lock, Plus, Trash2, Copy, Eye, EyeOff, Check } from 'lucide-react'
import { usersApi, apiKeysApi, authApi, getErrorMessage } from '@/api/client'
import { Reveal, PlanBadge, Spinner } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const TABS = [
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'password',  label: 'Password',  icon: Lock },
  { id: 'api',       label: 'API Keys',  icon: Key },
  { id: 'notifs',    label: 'Notifications', icon: Bell },
]

function Tab({ label, icon: Icon, active, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
      fontSize: 13.5, fontWeight: active ? 600 : 500,
      background: active ? 'var(--bg)' : 'transparent',
      color: active ? 'var(--fg)' : 'var(--fg-4)',
      boxShadow: active ? 'var(--sh)' : 'none', transition: 'all 0.14s',
    }}>
      <Icon size={14} /> {label}
    </button>
  )
}

function ProfileTab() {
  const { user, updateUser } = useAuthStore()
  const [form, setForm] = useState({ display_name: user?.display_name || '', bio: '', website: '', location: '', preferred_language: user?.preferred_language || 'en' })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      await usersApi.updateProfile(form)
      updateUser(form)
      toast.success('Profile updated')
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label className="label">Display Name</label><input value={form.display_name} onChange={set('display_name')} className="input" /></div>
        <div><label className="label">Language</label>
          <select value={form.preferred_language} onChange={set('preferred_language')} className="input select">
            {[['en','English'],['es','Spanish'],['fr','French'],['de','German'],['zh','Chinese'],['ja','Japanese']].map(([c,l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
      </div>
      <div><label className="label">Bio</label><textarea value={form.bio} onChange={set('bio') as any} className="input textarea" rows={3} placeholder="Tell the community about yourself…" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label className="label">Website</label><input value={form.website} onChange={set('website')} className="input" placeholder="https://…" /></div>
        <div><label className="label">Location</label><input value={form.location} onChange={set('location')} className="input" placeholder="City, Country" /></div>
      </div>
      <div>
        <label className="label">Email</label>
        <input value={user?.email || ''} disabled className="input" />
        <div style={{ fontSize: 12, color: 'var(--fg-5)', marginTop: 4 }}>Email cannot be changed. Contact support if needed.</div>
      </div>
      <div style={{ paddingTop: 8 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ gap: 6 }}>
          {saving ? <Spinner size={14} /> : <Check size={14} />} Save Changes
        </button>
      </div>
    </div>
  )
}

function PasswordTab() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [showCurr, setShowCurr] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (form.new_password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    try {
      await authApi.changePassword(form.current_password, form.new_password)
      toast.success('Password changed')
      setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}>
      <div>
        <label className="label">Current Password</label>
        <div style={{ position: 'relative' }}>
          <input type={showCurr ? 'text' : 'password'} value={form.current_password} onChange={set('current_password')} className="input" style={{ paddingRight: 40 }} />
          <button onClick={() => setShowCurr(!showCurr)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', display: 'flex' }}>
            {showCurr ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div>
        <label className="label">New Password</label>
        <div style={{ position: 'relative' }}>
          <input type={showNew ? 'text' : 'password'} value={form.new_password} onChange={set('new_password')} className="input" style={{ paddingRight: 40 }} />
          <button onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', display: 'flex' }}>
            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div><label className="label">Confirm New Password</label><input type="password" value={form.confirm} onChange={set('confirm')} className="input" /></div>
      <button onClick={save} disabled={saving || !form.current_password || !form.new_password} className="btn btn-primary" style={{ gap: 6 }}>
        {saving ? <Spinner size={14} /> : <Lock size={14} />} Change Password
      </button>
    </div>
  )
}

function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiKeysApi.list().then(d => setKeys(d.keys || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!newKeyName.trim()) { toast.error('Enter a key name'); return }
    setCreating(true)
    try {
      const data = await apiKeysApi.create(newKeyName.trim())
      setNewKey(data.key)
      setKeys(prev => [{ id: data.id, name: data.name, prefix: data.prefix, scopes: data.scopes, created_at: new Date().toISOString(), usage_count: 0 }, ...prev])
      setNewKeyName('')
      toast.success('API key created — save it now, it won\'t be shown again!')
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setCreating(false) }
  }

  const revoke = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? This cannot be undone.`)) return
    await apiKeysApi.revoke(id).catch(() => {})
    setKeys(prev => prev.filter(k => k.id !== id))
    toast.success('Key revoked')
  }

  const copyKey = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <div>
      {newKey && (
        <div style={{ padding: '14px 16px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>🔑 New API Key — Copy it now, it won't be shown again</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <code style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{newKey}</code>
            <button onClick={copyKey} className="btn btn-secondary btn-sm" style={{ gap: 5, flexShrink: 0 }}>
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production, Staging)" className="input" onKeyDown={e => e.key === 'Enter' && create()} />
        <button onClick={create} disabled={creating || !newKeyName.trim()} className="btn btn-primary" style={{ gap: 6, flexShrink: 0 }}>
          {creating ? <Spinner size={14} /> : <Plus size={14} />} Create Key
        </button>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size={20} /></div> : keys.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg-4)', fontSize: 13.5 }}>No API keys yet. Create one to access the API programmatically.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {keys.map(k => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border-2)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={16} style={{ color: 'var(--blue)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)' }}>{k.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-4)', fontFamily: 'monospace' }}>
                  {k.prefix}… · {k.usage_count?.toLocaleString()} uses
                  {k.last_used_at && ` · last used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {(k.scopes || []).map((s: string) => <span key={s} className="badge badge-gray" style={{ fontSize: 10 }}>{s}</span>)}
              </div>
              <button onClick={() => revoke(k.id, k.name)} style={{ padding: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', borderRadius: 7, display: 'flex', transition: 'all 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.color = 'var(--red)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--fg-5)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotifsTab() {
  const { user, updateUser } = useAuthStore()
  const [emailNotifs, setEmailNotifs] = useState(user?.email_notifications ?? true)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await usersApi.updateProfile({ email_notifications: emailNotifs })
      updateUser({ email_notifications: emailNotifs })
      toast.success('Preferences saved')
    } catch (e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 440 }}>
      <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border-2)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)' }}>Email Notifications</div>
            <div style={{ fontSize: 13, color: 'var(--fg-4)', marginTop: 3 }}>Receive emails for job completions, alerts, and plan changes</div>
          </div>
          <button onClick={() => setEmailNotifs(!emailNotifs)}
            style={{ width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', background: emailNotifs ? 'var(--blue)' : 'var(--bg-4)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <motion.div animate={{ x: emailNotifs ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ position: 'absolute', top: 3, left: 0, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
          </button>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ gap: 6 }}>
        {saving ? <Spinner size={14} /> : <Check size={14} />} Save Preferences
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('profile')

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      <Reveal>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.025em', marginBottom: 24 }}>
          <Settings size={22} style={{ color: 'var(--fg-3)' }} /> Settings
        </h1>
      </Reveal>

      <Reveal delay={0.04}>
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-3)', borderRadius: 12, padding: 3, marginBottom: 24, width: 'fit-content' }}>
          {TABS.map(t => <Tab key={t.id} {...t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="card" style={{ padding: 28 }}>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {tab === 'profile'  && <ProfileTab />}
              {tab === 'password' && <PasswordTab />}
              {tab === 'api'      && <ApiKeysTab />}
              {tab === 'notifs'   && <NotifsTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
    </div>
  )
}
