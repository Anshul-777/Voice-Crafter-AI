import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Wand2, Zap, Trash2, Globe, Lock, Building2, Heart, MessageSquare, Share2, ChevronLeft, Play, ExternalLink, Download } from 'lucide-react'
import { voicesApi, getErrorMessage } from '@/api/client'
import { Reveal, WaveBars, Spinner } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const VIS_ICON: Record<string, any> = { private: Lock, organization: Building2, public: Globe }

export default function VoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [voice, setVoice] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [liked, setLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [playingPreview, setPlayingPreview] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([voicesApi.get(id), voicesApi.getComments(id)])
      .then(([v, c]) => { setVoice(v); setComments(c || []) })
      .catch(() => navigate('/voices'))
      .finally(() => setLoading(false))
  }, [id])

  const handleLike = async () => {
    if (!id) return
    try {
      const r = await voicesApi.toggleLike(id)
      setLiked(r.liked)
      setVoice((v: any) => v ? { ...v, likes_count: r.likes_count } : v)
    } catch { toast.error('Failed') }
  }

  const handleComment = async () => {
    if (!newComment.trim() || !id) return
    setSubmitting(true)
    try {
      const c = await voicesApi.addComment(id, newComment.trim())
      setComments(prev => [{ ...c, user: { username: user?.username, display_name: user?.display_name } }, ...prev])
      setNewComment('')
      toast.success('Comment posted')
    } catch { toast.error('Failed to post comment') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={24} /></div>
  if (!voice) return null

  const isOwner = user?.id === voice.owner_id
  const VisIcon = VIS_ICON[voice.visibility] || Lock
  const hue = voice.id ? parseInt(voice.id.replace(/-/g, '').slice(0, 6), 16) % 360 : 220
  const qColor = voice.quality_score >= 0.8 ? 'var(--green)' : voice.quality_score >= 0.6 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <Reveal>
        <button onClick={() => navigate('/voices')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--fg-3)', marginBottom: 24 }}>
          <ChevronLeft size={14} /> My Voices
        </button>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Hero */}
          <Reveal>
            <div className="card" style={{ padding: 28, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, hsl(${hue},70%,55%), hsl(${hue+60},65%,60%))` }} />
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {voice.avatar_url
                  ? <img src={voice.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 64, height: 64, borderRadius: 16, background: `hsl(${hue},65%,55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>{voice.name?.slice(0,2).toUpperCase()}</div>
                }
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', marginBottom: 8 }}>{voice.name}</h1>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                        {[voice.language?.toUpperCase(), voice.gender, voice.speaking_style].filter(Boolean).map((t: string) => (
                          <span key={t} className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{t}</span>
                        ))}
                        <span className="badge badge-gray" style={{ gap: 4 }}><VisIcon size={10} />{voice.visibility}</span>
                        {voice.fine_tuned && <span className="badge badge-blue">Fine-tuned</span>}
                        {voice.is_hub_featured && <span className="badge badge-amber">⭐ Featured</span>}
                      </div>
                    </div>
                    {isOwner && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/clone?voice=${id}`} className="btn btn-secondary btn-sm" style={{ gap: 5 }}><Zap size={12} />Re-clone</Link>
                        <button onClick={async () => { if (id && confirm('Archive this voice?')) { await voicesApi.delete(id); toast.success('Archived'); navigate('/voices') } }} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>

                  {voice.description && <p style={{ fontSize: 13.5, color: 'var(--fg-3)', lineHeight: 1.65, marginBottom: 16 }}>{voice.description}</p>}

                  {/* Preview waveform */}
                  <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <button onClick={() => setPlayingPreview(!playingPreview)} style={{ width: 30, height: 30, borderRadius: '50%', background: `hsl(${hue},65%,55%)`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {playingPreview ? <span style={{ color: 'white', fontSize: 9 }}>■</span> : <Play size={11} color="white" style={{ marginLeft: 1 }} />}
                    </button>
                    <WaveBars color={`hsl(${hue},65%,55%)`} bars={18} height={26} active={playingPreview} />
                    {voice.preview_url && (
                      <a href={voice.preview_url} download style={{ marginLeft: 'auto', padding: 6, borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg-4)', display: 'flex' }}>
                        <Download size={12} />
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link to={`/generate?voice=${id}`} className="btn btn-primary" style={{ gap: 7 }}><Wand2 size={14} />Generate</Link>
                    <button onClick={handleLike} className={`btn ${liked ? 'btn-outline' : 'btn-secondary'}`} style={{ gap: 7, color: liked ? '#db2777' : undefined, borderColor: liked ? '#db2777' : undefined }}>
                      <Heart size={14} fill={liked ? '#db2777' : 'none'} />{voice.likes_count || 0}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied') }} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
                      <Share2 size={13} />Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Tags */}
          {[...(voice.emotion_tags||[]), ...(voice.use_case_tags||[]), ...(voice.custom_tags||[])].length > 0 && (
            <Reveal delay={0.05}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[...(voice.emotion_tags||[]), ...(voice.use_case_tags||[]), ...(voice.custom_tags||[])].map((t: string) => (
                    <span key={t} style={{ padding: '5px 12px', borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--border-2)', fontSize: 12.5, color: 'var(--fg-3)', fontWeight: 500 }}>{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {/* Comments */}
          <Reveal delay={0.08}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={15} style={{ color: 'var(--fg-4)' }} />Comments ({comments.length})
              </div>
              {user && (
                <div style={{ marginBottom: 20 }}>
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} className="input textarea" rows={3} placeholder="Add a comment…" style={{ marginBottom: 8 }} />
                  <button onClick={handleComment} disabled={submitting || !newComment.trim()} className="btn btn-primary btn-sm" style={{ gap: 5 }}>
                    {submitting ? <Spinner size={12} /> : 'Post'}
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {comments.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--fg-5)', fontSize: 13.5 }}>No comments yet. Be the first!</div>}
                {comments.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', flexShrink: 0 }}>
                      {c.user?.display_name?.charAt(0) ?? '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>{c.user?.display_name}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--fg-5)' }}>{c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Reveal delay={0.06}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Stats</div>
              {[
                ['Plays', (voice.plays_count||0).toLocaleString()],
                ['Likes', (voice.likes_count||0).toLocaleString()],
                ['Downloads', (voice.downloads_count||0).toLocaleString()],
                ['Quality', voice.quality_score != null ? `${(voice.quality_score*100).toFixed(0)}%` : '—'],
                ['Similarity', voice.similarity_score != null ? `${(voice.similarity_score*100).toFixed(0)}%` : '—'],
                ['Model', voice.base_model || 'xtts_v2'],
                ['Training', voice.training_status || '—'],
                ['License', voice.license_type || 'personal'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-2)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>{k}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'capitalize' }}>{v}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.09}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to={`/generate?voice=${id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}><Wand2 size={14} />Generate Speech</Link>
              <Link to={`/clone?voice=${id}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}><Zap size={14} />Clone / Improve</Link>
            </div>
          </Reveal>

          <Reveal delay={0.11}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Timestamps</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-4)', lineHeight: 2 }}>
                <div>Created {voice.created_at ? formatDistanceToNow(new Date(voice.created_at), { addSuffix: true }) : '—'}</div>
                <div>Updated {voice.updated_at ? formatDistanceToNow(new Date(voice.updated_at), { addSuffix: true }) : '—'}</div>
              </div>
              {voice.consent_verified && (
                <div style={{ marginTop: 10, padding: '7px 10px', background: 'rgba(22,163,74,0.06)', borderRadius: 8, fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>✓ Consent verified</div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
