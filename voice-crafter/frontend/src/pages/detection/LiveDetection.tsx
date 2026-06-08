import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Square, Mic, MicOff, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react'
import { Reveal, WaveBars, VerdictBadge, StatusBadge } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

interface ChunkResult {
  chunk_idx: number
  timestamp_ms: number
  ensemble_score: number
  verdict: string
  is_suspicious: boolean
  model_scores: Record<string, number>
  flagged_reasons: string[]
  latency_ms: number
  session_stats: {
    total_chunks: number
    suspicious_count: number
    avg_score: number
    max_score: number
    session_verdict: string
    elapsed_seconds: number
  }
}

function ScoreGauge({ score, size = 96 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circ = 2 * Math.PI * radius
  const pct = Math.min(1, score)
  const dashLen = circ * 0.75
  const offset = dashLen * (1 - pct)
  const color = score >= 0.65 ? '#dc2626' : score >= 0.4 ? '#d97706' : '#16a34a'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-135deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--bg-3)" strokeWidth={6} strokeDasharray={`${dashLen} ${circ - dashLen}`} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dashLen - offset} ${circ - (dashLen - offset)}`}
          strokeLinecap="round" style={{ transition: 'all 0.4s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 700, color, lineHeight: 1 }}>{(score * 100).toFixed(0)}%</div>
        <div style={{ fontSize: size * 0.115, color: 'var(--fg-4)', marginTop: 2 }}>risk</div>
      </div>
    </div>
  )
}

function ModelBar({ name, score }: { name: string; score?: number }) {
  const v = score ?? 0
  const color = v >= 0.65 ? '#dc2626' : v >= 0.4 ? '#d97706' : '#16a34a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 72, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{name}</div>
      <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${v * 100}%` }} transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 99, background: color }} />
      </div>
      <div style={{ width: 36, fontSize: 12, fontWeight: 700, textAlign: 'right', color, flexShrink: 0 }}>{(v * 100).toFixed(0)}%</div>
    </div>
  )
}

export default function LiveDetection() {
  const { accessToken } = useAuthStore()
  const [running, setRunning]         = useState(false)
  const [connected, setConnected]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [latest, setLatest]           = useState<ChunkResult | null>(null)
  const [timeline, setTimeline]       = useState<{ t: number; score: number }[]>([])
  const [sessionVerdict, setVerdict]  = useState<string>('–')
  const [micAllowed, setMicAllowed]   = useState(true)
  const [threshold]                   = useState(0.65)

  const wsRef       = useRef<WebSocket | null>(null)
  const mediaRef    = useRef<MediaStream | null>(null)
  const processorRef= useRef<ScriptProcessorNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunkRef    = useRef<number>(0)

  const encodeFloat32ToWav = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buf = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buf)
    const w = (off: number, v: number, b: number) => b === 2 ? view.setUint16(off, v, true) : b === 4 ? view.setUint32(off, v, true) : view.setUint8(off, v)
    const writeStr = (off: number, str: string) => [...str].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)))
    writeStr(0, 'RIFF'); w(4, 36 + samples.length * 2, 4); writeStr(8, 'WAVE')
    writeStr(12, 'fmt '); w(16, 16, 4); w(20, 1, 2); w(22, 1, 2)
    w(24, sampleRate, 4); w(28, sampleRate * 2, 4); w(32, 2, 2); w(34, 16, 2)
    writeStr(36, 'data'); w(40, samples.length * 2, 4)
    const vol = 0x8000
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(44 + i * 2, s < 0 ? s * vol : s * (vol - 1), true)
    }
    return buf
  }

  const startSession = useCallback(async () => {
    setError(null); setTimeline([]); setLatest(null); setVerdict('–')
    chunkRef.current = 0

    // Mic permission
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }, video: false })
      mediaRef.current = stream
      setMicAllowed(true)
    } catch {
      setMicAllowed(false)
      setError('Microphone access denied. Please allow mic access and try again.')
      return
    }

    // WebSocket
    const ws = new WebSocket(`${WS_URL}/ws/detect/stream?token=${accessToken}&session_id=live-${Date.now()}&confidence_threshold=${threshold}`)
    wsRef.current = ws

    ws.onopen = () => { setConnected(true); setRunning(true) }
    ws.onclose = () => { setConnected(false); setRunning(false) }
    ws.onerror = () => setError('WebSocket connection failed. Check your server is running.')

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'chunk_result') {
          setLatest(msg)
          setTimeline(prev => [...prev.slice(-120), { t: chunkRef.current, score: msg.ensemble_score }])
          if (msg.session_stats?.session_verdict) setVerdict(msg.session_stats.session_verdict)
        }
      } catch {}
    }

    // Audio pipeline
    const ctx = new AudioContext({ sampleRate: 16000 })
    audioCtxRef.current = ctx
    const src = ctx.createMediaStreamSource(stream)
    const proc = ctx.createScriptProcessor(8192, 1, 1)
    processorRef.current = proc

    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return
      const samples = e.inputBuffer.getChannelData(0)
      const wav = encodeFloat32ToWav(new Float32Array(samples), ctx.sampleRate)
      ws.send(wav)
      chunkRef.current++
    }

    src.connect(proc); proc.connect(ctx.destination)
  }, [accessToken, threshold])

  const stopSession = useCallback(() => {
    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
    mediaRef.current?.getTracks().forEach(t => t.stop())
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_stream' }))
      wsRef.current.close()
    }
    setRunning(false); setConnected(false)
  }, [])

  useEffect(() => () => { stopSession() }, [])

  const verdictColor = sessionVerdict === 'synthetic' ? '#dc2626' : sessionVerdict === 'suspicious' ? '#d97706' : sessionVerdict === 'authentic' ? '#16a34a' : 'var(--fg-4)'
  const stats = latest?.session_stats

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={22} style={{ color: 'var(--fg-3)' }} />
              Live Detection
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>Real-time deepfake analysis from microphone. 5-model ensemble scores every audio chunk.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {running ? (
              <button onClick={stopSession} className="btn btn-danger" style={{ gap: 7 }}>
                <Square size={14} fill="white" /> Stop Session
              </button>
            ) : (
              <button onClick={startSession} className="btn btn-primary" style={{ gap: 7 }}>
                <Mic size={14} /> Start Live Detection
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {/* Connection status */}
      <Reveal delay={0.04}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 24 }}>
          {running ? <Wifi size={16} style={{ color: 'var(--green)' }} /> : <WifiOff size={16} style={{ color: 'var(--fg-5)' }} />}
          <div style={{ display: 'flex', items: 'center', gap: 6, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: running ? 'var(--green)' : 'var(--fg-4)' }}>
              {running ? 'Streaming & analyzing…' : 'Stopped'}
            </span>
            {running && stats && (
              <span style={{ fontSize: 12, color: 'var(--fg-4)', marginLeft: 10 }}>
                {stats.total_chunks} chunks · {stats.elapsed_seconds.toFixed(0)}s · avg {(stats.avg_score * 100).toFixed(1)}% risk
              </span>
            )}
          </div>
          {running && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <motion.div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 600 }}>LIVE</span>
            </div>
          )}
        </div>
      </Reveal>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, marginBottom: 20, fontSize: 13.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left: Timeline + waveform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Live waveform indicator */}
          <Reveal>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Audio Input</div>
                {running ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mic size={14} style={{ color: 'var(--blue)' }} />
                    <WaveBars color="var(--blue)" bars={20} height={28} active={running} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-4)', fontSize: 13 }}>
                    <MicOff size={14} /> Microphone idle
                  </div>
                )}
              </div>
              {/* Confidence timeline chart */}
              <div style={{ height: 180 }}>
                {timeline.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <defs>
                        <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, boxShadow: 'var(--sh-md)' }}
                        formatter={(v: any) => [`${(v*100).toFixed(1)}%`, 'Risk Score']}
                        labelFormatter={l => `Chunk ${l}`}
                      />
                      <Area type="monotone" dataKey="score" stroke="var(--blue)" fill="url(#liveGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-5)', fontSize: 13.5 }}>
                    {running ? 'Waiting for first audio chunk…' : 'Start session to see live timeline'}
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          {/* Model scores */}
          <Reveal delay={0.05}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 18 }}>Per-Model Scores (last chunk)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['aasist','rawnet2','prosodic','spectral','glottal'].map(m => (
                  <ModelBar key={m} name={m} score={latest?.model_scores?.[m]} />
                ))}
              </div>
              {latest?.flagged_reasons?.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Flagged signals</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {latest.flagged_reasons.map(r => (
                      <span key={r} className="badge badge-red" style={{ fontSize: 11 }}>{r.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>

        {/* Right: Session verdict & stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Reveal delay={0.06}>
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Session Verdict</div>
              <ScoreGauge score={stats?.avg_score ?? 0} size={108} />
              <div style={{ marginTop: 16, padding: '8px 14px', borderRadius: 99, display: 'inline-block', fontSize: 13, fontWeight: 700, color: verdictColor, background: `color-mix(in srgb, ${verdictColor} 10%, transparent)` }}>
                {sessionVerdict === '–' ? 'Awaiting data' : sessionVerdict.charAt(0).toUpperCase() + sessionVerdict.slice(1)}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Session Stats</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Total chunks', value: stats?.total_chunks ?? 0 },
                  { label: 'Suspicious chunks', value: stats?.suspicious_count ?? 0 },
                  { label: 'Max risk score', value: stats ? `${(stats.max_score * 100).toFixed(1)}%` : '—' },
                  { label: 'Avg risk score', value: stats ? `${(stats.avg_score * 100).toFixed(1)}%` : '—' },
                  { label: 'Duration', value: stats ? `${stats.elapsed_seconds.toFixed(0)}s` : '—' },
                  { label: 'Last latency', value: latest ? `${latest.latency_ms.toFixed(0)}ms` : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-4)' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {!running && (
            <Reveal delay={0.1}>
              <div className="card-inset" style={{ padding: 16, fontSize: 13, color: 'var(--fg-4)', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, color: 'var(--fg-3)', marginBottom: 6 }}>How it works</div>
                Your microphone audio is streamed in 512ms chunks via WebSocket. Each chunk is analyzed by 5 detection models in parallel. Results update in real-time with per-model confidence scores.
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  )
}
