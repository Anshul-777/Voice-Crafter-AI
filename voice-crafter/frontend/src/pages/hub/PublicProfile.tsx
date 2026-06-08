import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Play, Heart, Mic2, UserPlus, UserMinus } from 'lucide-react'
import { usersApi, getErrorMessage } from '@/api/client'
import { Reveal, WaveBars, PlanBadge, Spinner } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    usersApi.getPublicProfile(username)
      .then(d => setProfile(d))
      .catch(() => navigate('/hub'))
      .finally(() => setLoading(false))
  }, [username])

  const handleFollow = async () => {
    if (!user) { navigate('/login'); return }
    if (!profile) return
    try {
      const r = await usersApi.toggleFollow(profile.id)
      setFollowing(r.following)
      setProfile((p: any) => p ? { ...p, followers_count: r.followers_count } : p)
      toast.success(r.following ? 'Following' : 'Unfollowed')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={24} /></div>
  if (!profile) return null

  const isOwn = user?.id === profile.id

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      <Reveal>
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>
                  {profile.display_name?.charAt(0).toUpperCase()}
                </div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{profile.display_name}</h1>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-4)', marginBottom: 10 }}>@{profile.username}</div>
              {profile.bio && <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.6, marginBottom: 12, maxWidth: 480 }}>{profile.bio}</p>}
              <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                {[
                  { label: 'Voices', value: profile.voices_count || 0 },
                  { label: 'Followers', value: profile.followers_count || 0 },
                  { label: 'Following', value: profile.following_count || 0 },
                  { label: 'Plays', value: profile.plays_count || 0 },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)' }}>{s.value.toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-5)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {!isOwn && user && (
                <button onClick={handleFollow} className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`} style={{ gap: 7 }}>
                  {following ? <><UserMinus size={14} />Unfollow</> : <><UserPlus size={14} />Follow</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Public voices */}
      {profile.recent_voices?.length > 0 && (
        <Reveal delay={0.05}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Voices</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {profile.recent_voices.map((v: any) => (
              <Link key={v.id} to={`/hub/${v.id}`} style={{ textDecoration: 'none' }}>
                <div className="card-hover" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-2)', marginBottom: 8 }}>{v.name}</div>
                  <WaveBars color="var(--blue)" bars={12} height={20} active={false} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 12, color: 'var(--fg-5)' }}>
                    <span><Play size={10} style={{ marginRight: 3 }} />{(v.plays_count||0).toLocaleString()}</span>
                    <span><Heart size={10} style={{ marginRight: 3 }} />{(v.likes_count||0).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  )
}
