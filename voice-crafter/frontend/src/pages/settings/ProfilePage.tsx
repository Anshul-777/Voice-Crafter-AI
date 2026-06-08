// ProfilePage - user's public profile editor
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, Globe, Mic2, Heart, Play, Users, UserPlus, UserMinus, Settings } from 'lucide-react'
import { usersApi, voicesApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, WaveBars, PlanBadge, Spinner, EmptyState } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore()
  const [voices, setVoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return
    voicesApi.list({ visibility: 'public', page_size: 12 })
      .then(d => setVoices(d.voices || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const url = ev.target?.result as string
        await usersApi.updateProfile({ avatar_url: url })
        await refreshUser()
        toast.success('Avatar updated')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (e) { toast.error(getErrorMessage(e)); setUploading(false) }
  }

  if (!user) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-4)' }}>Not logged in</div>

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={22} style={{ color: 'var(--fg-3)' }} /> My Profile
          </h1>
          <Link to="/settings" className="btn btn-secondary btn-sm" style={{ gap: 6 }}><Settings size={13} />Edit Settings</Link>
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <label style={{ cursor: 'pointer', display: 'block' }}>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: '3px solid var(--border)' }} />
                  : <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 28, fontWeight: 700 }}>
                      {user.display_name?.charAt(0).toUpperCase()}
                    </div>
                }
                {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} color="white" /></div>}
                <div style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%', background: 'var(--blue)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white' }}>✎</div>
              </label>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>{user.display_name}</h2>
                <PlanBadge tier={user.plan_tier} />
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-4)', marginBottom: 10 }}>@{user.username}</div>
              {user.bio && <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.6, marginBottom: 12, maxWidth: 480 }}>{user.bio}</p>}
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  { label: 'Voices', value: user.voices_count || 0, icon: Mic2 },
                  { label: 'Followers', value: user.followers_count || 0, icon: Users },
                  { label: 'Following', value: user.following_count || 0, icon: UserPlus },
                  { label: 'Plays', value: user.plays_count || 0, icon: Play },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)' }}>{s.value.toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-5)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Public voices */}
      <Reveal delay={0.08}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Public Voices
        </div>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />)}
          </div>
        ) : voices.length === 0 ? (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <Mic2 size={28} style={{ color: 'var(--fg-5)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: 'var(--fg-4)' }}>No public voices yet</div>
            <div style={{ fontSize: 13, color: 'var(--fg-5)', marginTop: 4 }}>Set a voice to "Public" to show it here</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {voices.map((v: any) => (
              <Link key={v.id} to={`/voices/${v.id}`} style={{ textDecoration: 'none' }}>
                <div className="card-hover" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-2)', marginBottom: 6 }}>{v.name}</div>
                  <WaveBars color="var(--blue)" bars={14} height={20} active={false} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 12, color: 'var(--fg-5)' }}>
                    <span><Heart size={10} style={{ marginRight: 3 }} />{v.likes_count || 0}</span>
                    <span><Play size={10} style={{ marginRight: 3 }} />{v.plays_count || 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Reveal>
    </div>
  )
}
