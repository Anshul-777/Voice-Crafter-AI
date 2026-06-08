// HubVoiceDetail.tsx
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Globe, Heart, Play, Download, Mic2, User, Star, ChevronLeft, MessageSquare, Share2 } from 'lucide-react'
import { hubApi, voicesApi, getErrorMessage } from '@/api/client'
import { Reveal, WaveBars, StatusBadge, Spinner, EmptyState } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function HubVoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [voice, setVoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [liking, setLiking] = useState(false)

  useEffect(() => {
    if (!id) return
    hubApi.getVoice(id).then(d => setVoice(d)).catch(() => navigate('/hub')).finally(() => setLoading(false))
  }, [id])

  const handleClone = () => {
    if (!user) { navigate('/login'); return }
    navigate(`/clone?hub_voice=${id}`)
  }

  const handleLike = async () => {
    if (!user || !voice) return
    setLiking(true)
    try {
      const result = await voicesApi.toggleLike(voice.id)
      setVoice((prev: any) => ({ ...prev, likes_count: result.likes_count }))
    } catch {}
    finally { setLiking(false) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={24} /></div>
  if (!voice) return null

  const palette = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626']
  const color = palette[voice.id?.charCodeAt(0) % palette.length]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <Reveal>
        <button onClick={() => navigate('/hub')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--fg-3)', marginBottom: 24 }}>
          <ChevronLeft size={14} /> Back to Hub
        </button>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div>
          <Reveal>
            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {voice.avatar_url ? (
                  <img src={voice.avatar_url} alt="" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 18, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 26, flexShrink: 0 }}>
                    {voice.name?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>{voice.name}</h1>
                    {voice.is_hub_featured && <span className="badge badge-amber">⭐ Featured</span>}
                  </div>
                  {voice.owner && (
                    <button onClick={() => navigate(`/u/${voice.owner.username}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-4)', fontSize: 13, marginTop: 6, padding: 0 }}>
                      <User size={12} /> by {voice.owner.display_name}
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {voice.language && <span className="badge badge-blue">{voice.language.toUpperCase()}</span>}
                    {voice.gender && <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{voice.gender}</span>}
                    {voice.speaking_style && <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{voice.speaking_style}</span>}
                    {voice.accent && <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{voice.accent} accent</span>}
                    <span className="badge badge-gray">{voice.license_type}</span>
                  </div>
                </div>
              </div>

              {voice.description && (
                <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.7, marginTop: 20, borderTop: '1px solid var(--border-2)', paddingTop: 16 }}>
                  {voice.description}
                </p>
              )}

              {/* Preview player */}
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setPlaying(!playing)} style={{ width: 38, height: 38, borderRadius: '50%', background: color, border: 'none', cursor: voice.preview_url ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Play size={14} color="white" style={{ marginLeft: 2 }} />
                </button>
                <WaveBars color={color} bars={24} height={32} active={playing} />
                <span style={{ fontSize: 12, color: 'var(--fg-5)', marginLeft: 'auto', flexShrink: 0 }}>Preview</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={handleClone} style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'var(--blue)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: 'var(--sh-blue)', transition: 'all 0.14s' }}>
                  <Mic2 size={15} /> Use This Voice
                </button>
                <button onClick={handleLike} disabled={liking} style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.14s' }}>
                  <Heart size={15} style={{ color: '#db2777' }} /> {voice.likes_count || 0}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!') }} style={{ padding: '11px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.14s' }}>
                  <Share2 size={15} style={{ color: 'var(--fg-4)' }} />
                </button>
              </div>
            </div>
          </Reveal>

          {/* Tags */}
          {(voice.emotion_tags?.length > 0 || voice.use_case_tags?.length > 0) && (
            <Reveal delay={0.05}>
              <div className="card" style={{ padding: 22, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Tags & Use Cases</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {[...(voice.emotion_tags || []), ...(voice.use_case_tags || []), ...(voice.custom_tags || [])].map((t: string) => (
                    <span key={t} style={{ padding: '4px 12px', borderRadius: 99, border: '1px solid var(--border)', fontSize: 13, color: 'var(--fg-3)', background: 'var(--bg-2)', textTransform: 'capitalize' }}>{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Reveal delay={0.06}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Voice Statistics</div>
              {[
                { label: 'Total plays', value: (voice.plays_count || 0).toLocaleString(), icon: Play },
                { label: 'Likes', value: (voice.likes_count || 0).toLocaleString(), icon: Heart },
                { label: 'Times cloned', value: (voice.clones_count || 0).toLocaleString(), icon: Mic2 },
                { label: 'Quality score', value: voice.quality_score ? `${(voice.quality_score*100).toFixed(0)}%` : '—', icon: Star },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <s.icon size={13} style={{ color: 'var(--fg-4)' }} />
                    <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-2)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Technical Details</div>
              {[
                { label: 'Base model', value: voice.base_model || 'XTTS-v2' },
                { label: 'Fine-tuned', value: voice.fine_tuned ? 'Yes' : 'Zero-shot' },
                { label: 'Language', value: voice.language?.toUpperCase() || '—' },
                { label: 'License', value: voice.license_type || '—' },
                { label: 'Consent', value: voice.consent_verified ? '✓ Verified' : 'Not specified' },
                { label: 'Published', value: voice.created_at ? formatDistanceToNow(new Date(voice.created_at), { addSuffix: true }) : '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid var(--border-2)' }}>
                  <span style={{ color: 'var(--fg-4)' }}>{r.label}</span>
                  <span style={{ color: 'var(--fg-2)', fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
