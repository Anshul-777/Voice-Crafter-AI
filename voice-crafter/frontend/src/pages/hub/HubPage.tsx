import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Search, Heart, Play, Mic2, ChevronRight, Filter, Star, TrendingUp, Clock, Download } from 'lucide-react'
import { hubApi, voicesApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, CountUp, WaveBars, EmptyState, Spinner } from '@/components/ui/shared'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

const LANG_OPTIONS = [
  { code: '', label: 'All Languages' },
  { code: 'en', label: '🇺🇸 English' }, { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },  { code: 'de', label: '🇩🇪 German' },
  { code: 'it', label: '🇮🇹 Italian' }, { code: 'pt', label: '🇵🇹 Portuguese' },
  { code: 'zh', label: '🇨🇳 Chinese' }, { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'ko', label: '🇰🇷 Korean' },  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ru', label: '🇷🇺 Russian' }, { code: 'ar', label: '🇸🇦 Arabic' },
]
const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'newest',  label: 'Newest',       icon: Clock },
  { value: 'likes',   label: 'Most Liked',   icon: Heart },
]
const PALETTE = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#db2777','#65a30d']

function VoiceHubCard({ voice, onClone, onPlay }: { voice: any; onClone: () => void; onPlay: () => void }) {
  const [playing, setPlaying] = useState(false)
  const hue = PALETTE[voice.id?.charCodeAt(0) % PALETTE.length] ?? '#2563eb'
  const initials = voice.name?.slice(0,2).toUpperCase() ?? 'VC'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover"
      style={{ padding: 20 }}
      onClick={() => {}}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        {voice.avatar_url ? (
          <img src={voice.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 12, background: hue, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 17, flexShrink: 0, opacity: 0.9 }}>
            {initials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voice.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-4)' }}>
            <span>{voice.language?.toUpperCase()}</span>
            {voice.gender && <><span>·</span><span style={{ textTransform: 'capitalize' }}>{voice.gender}</span></>}
            {voice.speaking_style && <><span>·</span><span style={{ textTransform: 'capitalize' }}>{voice.speaking_style}</span></>}
          </div>
          {voice.owner && (
            <div style={{ fontSize: 11.5, color: 'var(--fg-5)', marginTop: 3 }}>by {voice.owner.display_name}</div>
          )}
        </div>
        {voice.is_hub_featured && (
          <span className="badge badge-amber" style={{ fontSize: 10, flexShrink: 0 }}>⭐ Featured</span>
        )}
      </div>

      {/* Wave preview */}
      <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setPlaying(!playing); onPlay() }}
          style={{ width: 28, height: 28, borderRadius: '50%', background: hue, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {playing ? <span style={{ color: '#fff', fontSize: 10 }}>■</span> : <Play size={11} color="#fff" style={{ marginLeft: 1 }} />}
        </button>
        <WaveBars color={hue} bars={16} height={24} active={playing} />
      </div>

      {/* Tags */}
      {(voice.emotion_tags?.length > 0 || voice.use_case_tags?.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {[...( voice.emotion_tags || []), ...(voice.use_case_tags || [])].slice(0, 3).map((t: string) => (
            <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-3)', color: 'var(--fg-4)', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg-4)' }}>
          <Play size={11} /><span>{(voice.plays_count || 0).toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg-4)' }}>
          <Heart size={11} /><span>{(voice.likes_count || 0).toLocaleString()}</span>
        </div>
        {voice.quality_score != null && (
          <div style={{ fontSize: 12, color: voice.quality_score >= 0.8 ? 'var(--green)' : 'var(--fg-4)', fontWeight: 600 }}>
            {(voice.quality_score * 100).toFixed(0)}% quality
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={(e) => { e.stopPropagation(); onClone() }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'var(--blue-soft)', color: 'var(--blue)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.12s' }}>
          <Download size={11} /> Use Voice
        </button>
      </div>
    </motion.div>
  )
}

export default function HubPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [voices, setVoices] = useState<any[]>([])
  const [featured, setFeatured] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [lang, setLang] = useState('')
  const [sort, setSort] = useState('popular')
  const PAGE_SIZE = 24

  useEffect(() => {
    hubApi.featured().then(d => setFeatured(d.voices || [])).catch(() => {})
    hubApi.stats().then(d => setStats(d)).catch(() => {})
    loadVoices(1, true)
  }, [])

  const loadVoices = useCallback(async (p: number, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    try {
      const data = await hubApi.listVoices({ page: p, page_size: PAGE_SIZE, search: search || undefined, language: lang || undefined, sort })
      setVoices(prev => reset ? (data.voices || []) : [...prev, ...(data.voices || [])])
      setTotal(data.total || 0)
      setPage(p)
    } catch {} finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [search, lang, sort])

  useEffect(() => { loadVoices(1, true) }, [search, lang, sort])

  const cloneVoice = async (voiceId: string) => {
    if (!user) { navigate('/login'); return }
    toast.success('Opening clone setup…')
    navigate(`/clone?hub_voice=${voiceId}`)
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px' }}>
      {/* Hero header */}
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 48, paddingBottom: 40, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: 'var(--blue-soft)', color: 'var(--blue)', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
            <Globe size={12} /> Public Voice Library
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 10 }}>
            Discover & clone community voices
          </h1>
          <p style={{ fontSize: 15, color: 'var(--fg-4)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Browse voices created and shared by the Voice-Crafter community. Preview, like, and clone any voice for your projects.
          </p>
          {stats && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-2)' }}>
              {[
                { label: 'Public Voices', value: stats.public_voices },
                { label: 'Active Users', value: stats.active_users },
                { label: 'Total Plays', value: stats.total_plays },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.03em' }}>
                    <CountUp to={s.value || 0} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-4)', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* Featured */}
      {featured.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <Reveal>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={13} /> Featured Voices
              </div>
            </div>
          </Reveal>
          <StaggerGroup className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, display: 'grid' }}>
            {featured.slice(0, 4).map((v: any) => (
              <StaggerItem key={v.id}>
                <VoiceHubCard voice={v} onClone={() => cloneVoice(v.id)} onPlay={() => {}} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      )}

      {/* Filters */}
      <Reveal>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-5)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voices…" className="input" style={{ paddingLeft: 34 }} />
          </div>
          <select value={lang} onChange={e => setLang(e.target.value)} className="input select" style={{ width: 160 }}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            {SORT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setSort(opt.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 38, borderRadius: 10, border: `1px solid ${sort === opt.value ? 'var(--blue)' : 'var(--border)'}`, background: sort === opt.value ? 'var(--blue-soft)' : 'var(--bg)', color: sort === opt.value ? 'var(--blue)' : 'var(--fg-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0 }}>
                <opt.icon size={13} />{opt.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Grid */}
      <div style={{ marginBottom: 6, fontSize: 13, color: 'var(--fg-4)' }}>
        {total.toLocaleString()} voices
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 220, borderRadius: 16 }} />
          ))}
        </div>
      ) : voices.length === 0 ? (
        <EmptyState icon={Globe} title="No voices found" description="Try different search terms or language filters." />
      ) : (
        <>
          <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            <AnimatePresence>
              {voices.map((v: any) => (
                <VoiceHubCard key={v.id} voice={v} onClone={() => cloneVoice(v.id)} onPlay={() => {}} />
              ))}
            </AnimatePresence>
          </motion.div>
          {voices.length < total && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button onClick={() => loadVoices(page + 1)} disabled={loadingMore} className="btn btn-secondary">
                {loadingMore ? <><Spinner size={14} /> Loading…</> : 'Load more voices'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
