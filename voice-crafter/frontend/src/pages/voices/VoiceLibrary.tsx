import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Mic2, Wand2, Edit3, Trash2, Globe, Lock, Building2, MoreHorizontal, Zap, Play } from 'lucide-react'
import { voicesApi } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem } from '@/hooks/motionVariants'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const LANGS: Record<string, string> = {
  en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹', ru: '🇷🇺', zh: '🇨🇳', ja: '🇯🇵', ko: '🇰🇷', ar: '🇸🇦', hi: '🇮🇳',
}
const VISIBILITY_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  private: { icon: Lock, label: 'Private', color: '#94a3b8' },
  organization: { icon: Building2, label: 'Org', color: '#7c3aed' },
  public: { icon: Globe, label: 'Public', color: '#059669' },
}
const TRAINING_COLORS: Record<string, string> = {
  ready: '#059669', training: '#d97706', failed: '#ef4444', pending: '#94a3b8',
}

function VoiceCard({ voice, onDelete, onGenerate, onClone }: { voice: any; onDelete: () => void; onGenerate: () => void; onClone: () => void }) {
  const [menu, setMenu] = useState(false)
  const [hovering, setHovering] = useState(false)
  const VisIcon = VISIBILITY_CONFIG[voice.visibility]?.icon || Lock
  const emoji = LANGS[voice.language] || '🌐'
  const qualityColor = voice.quality_score >= 0.8 ? '#059669' : voice.quality_score >= 0.6 ? '#d97706' : '#ef4444'

  const initials = voice.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const hues = voice.id ? parseInt(voice.id.slice(0, 4), 16) % 360 : 220

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.22 }}
      onHoverStart={() => setHovering(true)}
      onHoverEnd={() => setHovering(false)}
      className="card group relative cursor-pointer overflow-hidden"
      style={{ border: hovering ? '1px solid rgba(35,85,245,0.2)' : '1px solid #e8eef8', transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: hovering ? '0 8px 32px rgba(10,15,30,0.10)' : '0 2px 8px rgba(10,15,30,0.05)' }}>

      {/* Card top bar accent */}
      <div style={{ height: 3, background: `linear-gradient(90deg, hsl(${hues},75%,55%), hsl(${hues+40},70%,65%))` }} />

      <div style={{ padding: '20px 20px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            {voice.avatar_url ? (
              <img src={voice.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, hsl(${hues},70%,55%), hsl(${hues+40},65%,60%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16 }}>
                {initials}
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#0a0f1e', lineHeight: 1.2 }}>{voice.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 12 }}>{emoji}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{voice.language?.toUpperCase()}</span>
                {voice.gender && <span style={{ fontSize: 11, color: '#b0bcda' }}>· {voice.gender}</span>}
              </div>
            </div>
          </div>

          {/* Menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={e => { e.stopPropagation(); setMenu(!menu) }}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <MoreHorizontal size={15} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.15 }}
                  style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'white', borderRadius: 12, border: '1px solid #e8eef8', boxShadow: '0 8px 24px rgba(10,15,30,0.12)', minWidth: 160, zIndex: 20, padding: 6 }}
                  onMouseLeave={() => setMenu(false)}>
                  {[
                    { icon: Edit3, label: 'Edit profile', action: () => {} },
                    { icon: Wand2, label: 'Generate speech', action: onGenerate },
                    { icon: Zap, label: 'Re-clone', action: onClone },
                    { icon: Trash2, label: 'Delete voice', action: onDelete, danger: true },
                  ].map(item => (
                    <button key={item.label} onClick={() => { item.action(); setMenu(false) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: item.danger ? '#ef4444' : '#374151', textAlign: 'left', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = item.danger ? '#fff1f1' : '#f8faff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <item.icon size={13} />
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Description */}
        {voice.description && (
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {voice.description}
          </p>
        )}

        {/* Tags */}
        {voice.emotion_tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {voice.emotion_tags.slice(0, 4).map((tag: string) => (
              <span key={tag} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: '#f1f5f9', color: '#64748b' }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Metrics row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid #f4f7fd' }}>
          {/* Quality score */}
          {voice.quality_score != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: qualityColor }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: qualityColor }}>{Math.round(voice.quality_score * 100)}%</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>quality</span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Visibility badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <VisIcon size={12} style={{ color: VISIBILITY_CONFIG[voice.visibility]?.color || '#94a3b8' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: VISIBILITY_CONFIG[voice.visibility]?.color || '#94a3b8' }}>
              {VISIBILITY_CONFIG[voice.visibility]?.label}
            </span>
          </div>

          {/* Training status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRAINING_COLORS[voice.training_status] || '#94a3b8' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, textTransform: 'capitalize' }}>{voice.training_status}</span>
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <AnimatePresence>
        {hovering && voice.training_status === 'ready' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'linear-gradient(to top, white 60%, transparent)', display: 'flex', gap: 8 }}>
            <button onClick={onGenerate} style={{ flex: 1, padding: '8px', borderRadius: 9, background: 'linear-gradient(135deg, #2355f5, #1a3dd4)', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Wand2 size={12} /> Generate
            </button>
            <button onClick={() => {}} style={{ padding: '8px 12px', borderRadius: 9, background: '#f1f5f9', color: '#374151', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Play size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function VoiceLibrary() {
  const navigate = useNavigate()
  const [voices, setVoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('')
  const [total, setTotal] = useState(0)

  const loadVoices = async () => {
    setLoading(true)
    try {
      const data = await voicesApi.list({ search: search || undefined, visibility: visibility || undefined, page_size: 24 })
      setVoices(data.voices || [])
      setTotal(data.total || 0)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadVoices() }, [search, visibility])

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this voice profile?')) return
    try { await voicesApi.delete(id); toast.success('Voice archived'); loadVoices() }
    catch { toast.error('Failed to archive') }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: '#0a0f1e', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mic2 size={24} style={{ color: '#2355f5' }} /> My Voice Library
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{total} voice profiles · Manage, clone, and generate</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/clone" className="btn btn-secondary" style={{ gap: 7 }}><Zap size={14} /> Clone Voice</Link>
            <Link to="/voices/new" className="btn btn-primary" style={{ gap: 7 }}><Plus size={14} /> New Profile</Link>
          </div>
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal delay={0.05}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search voices…" className="input" style={{ paddingLeft: 36, height: 40 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ val: '', label: 'All' }, { val: 'private', label: '🔒 Private' }, { val: 'public', label: '🌐 Public' }].map(opt => (
              <button key={opt.val} onClick={() => setVisibility(opt.val)}
                style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${visibility === opt.val ? '#2355f5' : '#dde4f0'}`, background: visibility === opt.val ? 'rgba(35,85,245,0.08)' : 'white', color: visibility === opt.val ? '#2355f5' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.14s' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 220, borderRadius: 20 }} />
          ))}
        </div>
      ) : voices.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Mic2 size={28} style={{ color: '#94a3b8' }} />
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#0a0f1e', marginBottom: 8 }}>No voice profiles yet</div>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>Create your first voice profile and start cloning.</p>
          <Link to="/clone" className="btn btn-primary">Clone your first voice</Link>
        </motion.div>
      ) : (
        <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          <AnimatePresence>
            {voices.map(v => (
              <VoiceCard key={v.id} voice={v}
                onDelete={() => handleDelete(v.id)}
                onGenerate={() => navigate(`/generate?voice=${v.id}`)}
                onClone={() => navigate(`/clone?voice=${v.id}`)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
