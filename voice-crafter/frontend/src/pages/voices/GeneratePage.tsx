import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wand2, Mic2, ChevronDown, Play, Download, RefreshCw, Zap, Clock, FileAudio } from 'lucide-react'
import { voicesApi, generationApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem } from '@/hooks/motionVariants'
import WaveformVisualizer from '@/components/audio/WaveformVisualizer'
import toast from 'react-hot-toast'

const EMOTIONS = ['neutral', 'happy', 'sad', 'excited', 'calm', 'professional', 'storytelling', 'news']
const LANGUAGES = [
  { code: 'en', label: 'English 🇺🇸' }, { code: 'es', label: 'Spanish 🇪🇸' }, { code: 'fr', label: 'French 🇫🇷' },
  { code: 'de', label: 'German 🇩🇪' }, { code: 'it', label: 'Italian 🇮🇹' }, { code: 'pt', label: 'Portuguese 🇵🇹' },
  { code: 'ru', label: 'Russian 🇷🇺' }, { code: 'zh', label: 'Chinese 🇨🇳' }, { code: 'ja', label: 'Japanese 🇯🇵' },
  { code: 'ko', label: 'Korean 🇰🇷' }, { code: 'ar', label: 'Arabic 🇸🇦' }, { code: 'hi', label: 'Hindi 🇮🇳' },
]
const FORMATS = ['wav', 'mp3', 'flac', 'ogg']

function Slider({ label, value, min, max, step = 0.1, format = (v: number) => v.toFixed(1), onChange }: any) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="label" style={{ marginBottom: 0 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#2355f5' }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }} />
    </div>
  )
}

export default function GeneratePage() {
  const [voices, setVoices] = useState<any[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [text, setText] = useState('')
  const [language, setLanguage] = useState('en')
  const [emotion, setEmotion] = useState('neutral')
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [temperature, setTemperature] = useState(0.7)
  const [outputFormat, setOutputFormat] = useState('wav')
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const pollRef = useRef<NodeJS.Timeout>()

  const charCount = text.length
  const charLimit = 5000
  const charPct = (charCount / charLimit) * 100

  useEffect(() => {
    voicesApi.list({ page_size: 50 }).then(d => setVoices(d.voices || [])).catch(() => {})
    generationApi.list({ page_size: 8 }).then(d => setHistory(d.jobs || [])).catch(() => {})
  }, [])

  const generate = async () => {
    if (!text.trim()) { toast.error('Please enter text to generate'); return }
    setGenerating(true); setResult(null)
    try {
      const data = await generationApi.generate({ text, voice_profile_id: selectedVoice || undefined, language, emotion, speed, pitch, temperature, output_format: outputFormat })
      setJobId(data.job_id)
      pollForResult(data.job_id)
      toast.success('Generating audio…')
    } catch (err) { toast.error(getErrorMessage(err)); setGenerating(false) }
  }

  const pollForResult = (id: string) => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const data = await generationApi.getJob(id).catch(() => null)
      if (!data) return
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(pollRef.current)
        setJobId(null)
        setGenerating(false)
        setResult(data)
        if (data.status === 'completed') toast.success('Audio ready!')
        else toast.error(`Generation failed: ${data.error_message}`)
      }
    }, 1500)
  }

  const SAMPLE_TEXTS = [
    "Welcome to Voice-Crafter, the world's most complete AI voice platform.",
    "The quick brown fox jumps over the lazy dog. She sells seashells by the seashore.",
    "In the beginning, there was silence. Then came the voice — warm, clear, and unmistakably human.",
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <Reveal>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: '#0a0f1e', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wand2 size={24} style={{ color: '#7c3aed' }} /> Voice Generation
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Generate expressive natural speech from text. Choose voice, emotion, and style.</p>
        </div>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Left: Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Text input */}
          <Reveal>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="label" style={{ marginBottom: 0 }}>Text to generate</label>
                <span style={{ fontSize: 12, fontWeight: 600, color: charPct > 90 ? '#ef4444' : '#94a3b8' }}>
                  {charCount.toLocaleString()} / {charLimit.toLocaleString()}
                </span>
              </div>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                placeholder="Enter text to convert to speech…"
                className="input textarea" style={{ fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7, resize: 'none' }} />
              {/* Char bar */}
              <div style={{ height: 3, background: '#eaeffa', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, transition: 'width 0.3s, background 0.3s', width: `${Math.min(100, charPct)}%`, background: charPct > 90 ? '#ef4444' : charPct > 70 ? '#d97706' : '#2355f5' }} />
              </div>
              {/* Sample texts */}
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SAMPLE_TEXTS.map((s, i) => (
                  <button key={i} onClick={() => setText(s)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: '1px solid #dde4f0', background: 'transparent', color: '#64748b', cursor: 'pointer', transition: 'all 0.12s' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = '#f1f5f9'; (e.target as HTMLElement).style.color = '#0a0f1e' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = '#64748b' }}>
                    Sample {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Voice & Language */}
          <Reveal delay={0.05}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="label">Voice Profile</label>
                  <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="input select">
                    <option value="">System default voice</option>
                    {voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.language})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="input select">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Emotion selector */}
              <div style={{ marginTop: 20 }}>
                <label className="label">Emotion / Style</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EMOTIONS.map(e => (
                    <button key={e} onClick={() => setEmotion(e)}
                      style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${emotion === e ? '#2355f5' : '#dde4f0'}`, background: emotion === e ? 'rgba(35,85,245,0.09)' : 'white', color: emotion === e ? '#2355f5' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.13s', textTransform: 'capitalize' }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Advanced controls */}
          <Reveal delay={0.1}>
            <div className="card" style={{ padding: 20 }}>
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#0a0f1e' }}>Advanced Controls</span>
                <motion.div animate={{ rotate: showAdvanced ? 180 : 0 }}>
                  <ChevronDown size={15} style={{ color: '#94a3b8' }} />
                </motion.div>
              </button>
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                    <div style={{ paddingTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <Slider label="Speed" value={speed} min={0.5} max={2.0} step={0.05} format={(v: number) => `${v.toFixed(2)}×`} onChange={setSpeed} />
                      <Slider label="Temperature" value={temperature} min={0.1} max={1.0} step={0.05} format={(v: number) => v.toFixed(2)} onChange={setTemperature} />
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <label className="label">Output Format</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {FORMATS.map(f => (
                          <button key={f} onClick={() => setOutputFormat(f)}
                            style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1.5px solid ${outputFormat === f ? '#2355f5' : '#dde4f0'}`, background: outputFormat === f ? 'rgba(35,85,245,0.08)' : 'white', color: outputFormat === f ? '#2355f5' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>

        {/* Right: Output & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Generate button */}
          <Reveal>
            <motion.button onClick={generate} disabled={generating || !text.trim()} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              style={{ width: '100%', padding: '16px', borderRadius: 16, border: 'none', background: generating ? '#94a3b8' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', fontSize: 16, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: generating ? 'none' : '0 8px 24px rgba(124,58,237,0.28)', fontFamily: 'Syne, sans-serif' }}>
              {generating ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <RefreshCw size={18} />
                  </motion.div>
                  {jobId ? 'Generating…' : 'Queuing…'}
                </>
              ) : (
                <><Wand2 size={18} /> Generate Speech</>
              )}
            </motion.button>
          </Reveal>

          {/* Result */}
          <AnimatePresence>
            {result?.status === 'completed' && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#0a0f1e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                    Ready to play
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                    <Clock size={12} />
                    {result.duration_seconds?.toFixed(1)}s
                  </div>
                </div>
                {result.output_url ? (
                  <WaveformVisualizer url={result.output_url} height={64} showControls showDownload downloadFilename={`generation_${result.id}.${outputFormat}`} />
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#f8faff', borderRadius: 12, fontSize: 13, color: '#94a3b8' }}>
                    Audio generated. URL will expire in 24 hours.
                  </div>
                )}
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  {result.output_url && (
                    <a href={result.output_url} download={`generation.${outputFormat}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      <Download size={13} /> Download {outputFormat.toUpperCase()}
                    </a>
                  )}
                  <button onClick={() => { setResult(null); generate() }} className="btn btn-secondary btn-sm">
                    <RefreshCw size={13} /> Retry
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generating state */}
          {generating && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 32 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <motion.div key={i} style={{ width: 3, borderRadius: 99, background: 'linear-gradient(180deg, #7c3aed, #a78bfa)' }}
                      animate={{ scaleY: [0.3, 1.2, 0.3] }}
                      transition={{ duration: 1.1 + (i % 4) * 0.15, repeat: Infinity, delay: i * 0.09 }} />
                  ))}
                </div>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#0a0f1e' }}>Synthesizing speech…</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Using XTTS-v2 neural TTS</div>
            </div>
          )}

          {/* Recent history */}
          {history.length > 0 && (
            <Reveal delay={0.15}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#0a0f1e', marginBottom: 12 }}>Recent Generations</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.slice(0, 5).map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f7fd' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileAudio size={14} style={{ color: '#7c3aed' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.text?.slice(0, 40)}…
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{h.language} · {h.duration_seconds?.toFixed(1) || '?'}s · {h.output_format}</div>
                      </div>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: h.status === 'completed' ? '#059669' : h.status === 'failed' ? '#ef4444' : '#d97706', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  )
}
