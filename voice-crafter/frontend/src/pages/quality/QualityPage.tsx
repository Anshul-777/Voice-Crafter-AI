import React, { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Upload, FileAudio, X, CheckCircle, AlertTriangle,
  XCircle, Mic, Volume2, Activity, BarChart2, Clock, Zap, Info,
  ChevronDown, ChevronUp, Download
} from 'lucide-react'
import { qualityApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, Spinner, WaveBars } from '@/components/ui/shared'
import WaveformVisualizer from '@/components/audio/WaveformVisualizer'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import toast from 'react-hot-toast'

interface QualityResult {
  duration_seconds: number
  sample_rate: number
  channels: number
  format: string
  snr_db: number
  rms_db: number
  peak_db: number
  speech_ratio: number
  quality_score: number
  suitability: string
  issues: string[]
  recommendations: string[]
}

const SUITABILITY_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string; bg: string }> = {
  excellent: { color: '#16a34a', icon: CheckCircle, label: 'Excellent', bg: 'rgba(22,163,74,0.06)' },
  good:      { color: '#16a34a', icon: CheckCircle, label: 'Good',      bg: 'rgba(22,163,74,0.04)' },
  fair:      { color: '#d97706', icon: AlertTriangle, label: 'Fair',    bg: 'rgba(217,119,6,0.05)' },
  poor:      { color: '#dc2626', icon: XCircle, label: 'Poor',          bg: 'rgba(220,38,38,0.05)' },
}

function QualityGauge({ score }: { score: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dashLen = circ * 0.75
  const fill = (score / 100) * dashLen
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  return (
    <div style={{ position: 'relative', width: 128, height: 128 }}>
      <svg width="128" height="128" style={{ transform: 'rotate(-135deg)' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="8"
          strokeDasharray={`${dashLen} ${circ - dashLen}`} strokeLinecap="round" />
        <motion.circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDashoffset: dashLen }}
          animate={{ strokeDashoffset: dashLen - fill }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          strokeDasharray={`${dashLen} ${circ - dashLen}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>{Math.round(score)}</motion.div>
        <div style={{ fontSize: 11, color: 'var(--fg-5)', fontWeight: 600, marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, unit = '', color = 'var(--fg-2)', icon: Icon, tooltip }: {
  label: string; value: string | number; unit?: string; color?: string; icon: any; tooltip?: string
}) {
  const [showTip, setShowTip] = useState(false)
  return (
    <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border-2)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={14} style={{ color: 'var(--fg-4)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        </div>
        {tooltip && (
          <div style={{ position: 'relative' }} onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
            <Info size={12} style={{ color: 'var(--fg-5)', cursor: 'help' }} />
            {showTip && (
              <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 6, background: 'var(--fg)', color: 'white', padding: '6px 10px', borderRadius: 8, fontSize: 11.5, whiteSpace: 'nowrap', zIndex: 10, boxShadow: 'var(--sh-lg)' }}>
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toFixed(typeof unit === 'string' && unit.includes('Hz') ? 0 : 1) : value}
        {unit && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-4)', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  )
}

function IssueItem({ text, type }: { text: string; type: 'issue' | 'rec' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
      <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        background: type === 'issue' ? 'rgba(220,38,38,0.08)' : 'rgba(37,99,235,0.08)' }}>
        {type === 'issue'
          ? <AlertTriangle size={11} style={{ color: '#dc2626' }} />
          : <Zap size={11} style={{ color: 'var(--blue)' }} />}
      </div>
      <span style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}

const TIPS = [
  { icon: Mic, title: 'Recording environment', desc: 'Record in a quiet room. Soft furnishings reduce echo and background noise significantly.' },
  { icon: Volume2, title: 'Optimal volume', desc: 'Speak at natural conversational volume. Avoid whispering or shouting. Target -23 to -18 LUFS.' },
  { icon: Clock, title: 'Sample length', desc: 'For voice cloning, 30–120 seconds gives best results. Avoid recordings shorter than 5 seconds.' },
  { icon: Activity, title: 'SNR target', desc: 'Signal-to-noise ratio above 30dB is ideal. Below 15dB significantly impacts clone quality.' },
]

export default function QualityPage() {
  const [analyzing, setAnalyzing]     = useState(false)
  const [result, setResult]           = useState<QualityResult | null>(null)
  const [file, setFile]               = useState<File | null>(null)
  const [fileUrl, setFileUrl]         = useState<string | null>(null)
  const [history, setHistory]         = useState<{ file: string; result: QualityResult }[]>([])
  const [showRadar, setShowRadar]     = useState(false)
  const [comparing, setComparing]     = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'audio/*': ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.webm'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    onDrop: useCallback(async (accepted: File[]) => {
      const f = accepted[0]
      if (!f) return
      setFile(f)
      setResult(null)
      if (fileUrl) URL.revokeObjectURL(fileUrl)
      setFileUrl(URL.createObjectURL(f))
      setAnalyzing(true)
      try {
        const data: QualityResult = await qualityApi.analyze(f)
        setResult(data)
        setHistory(prev => [{ file: f.name, result: data }, ...prev.slice(0, 9)])
        if (data.quality_score >= 80) toast.success(`Excellent quality score: ${data.quality_score.toFixed(0)}/100`)
        else if (data.quality_score < 50) toast.error(`Low quality score: ${data.quality_score.toFixed(0)}/100 — see recommendations`)
      } catch (e) {
        toast.error(getErrorMessage(e))
      } finally {
        setAnalyzing(false)
      }
    }, [fileUrl]),
    onDropRejected: (rejections) => {
      if (rejections[0]?.errors[0]?.code === 'file-too-large') toast.error('File too large. Maximum 100MB.')
      else toast.error('Invalid file type. Use WAV, MP3, FLAC, OGG, M4A, or WebM.')
    },
  })

  const radarData = result ? [
    { metric: 'SNR', value: Math.min(100, Math.max(0, (result.snr_db / 40) * 100)) },
    { metric: 'Speech', value: result.speech_ratio * 100 },
    { metric: 'Volume', value: Math.min(100, Math.max(0, 100 + result.rms_db * 2)) },
    { metric: 'Clarity', value: result.quality_score },
    { metric: 'Duration', value: Math.min(100, (result.duration_seconds / 120) * 100) },
    { metric: 'Peak OK', value: result.peak_db < -1 ? 100 : Math.max(0, 100 + (result.peak_db + 1) * 20) },
  ] : []

  const barData = history.length > 1 ? history.slice().reverse().map(h => ({
    name: h.file.length > 14 ? h.file.slice(0, 12) + '…' : h.file,
    score: h.result.quality_score,
  })) : []

  const suitCfg = result ? (SUITABILITY_CONFIG[result.suitability] ?? SUITABILITY_CONFIG.fair) : null

  const exportReport = () => {
    if (!result || !file) return
    const report = {
      file: file.name, analyzed_at: new Date().toISOString(),
      quality_score: result.quality_score, suitability: result.suitability,
      metrics: { snr_db: result.snr_db, rms_db: result.rms_db, peak_db: result.peak_db, speech_ratio: result.speech_ratio, duration_seconds: result.duration_seconds, sample_rate: result.sample_rate },
      issues: result.issues, recommendations: result.recommendations,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `quality_${file.name.replace(/\.[^.]+$/, '')}.json`
    a.click()
    toast.success('Report exported')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <FlaskConical size={22} style={{ color: 'var(--fg-3)' }} /> Quality Lab
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>Analyze audio quality, SNR, speech content, and suitability for voice cloning.</p>
          </div>
          {result && (
            <button onClick={exportReport} className="btn btn-secondary" style={{ gap: 6 }}>
              <Download size={14} /> Export Report
            </button>
          )}
        </div>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Left — Upload & Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Dropzone */}
          <Reveal>
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? 'var(--blue)' : result ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
              borderRadius: 16, padding: file ? '20px 24px' : '48px 24px',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.18s ease',
              background: isDragActive ? 'var(--blue-soft)' : result ? 'rgba(37,99,235,0.01)' : 'var(--bg-2)',
            }}>
              <input {...getInputProps()} />
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileAudio size={22} style={{ color: 'var(--blue)' }} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--fg-4)', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Click or drop to replace</div>
                  </div>
                  {analyzing && <WaveBars color="var(--blue)" bars={8} height={28} active />}
                </div>
              ) : (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Upload size={22} style={{ color: isDragActive ? 'var(--blue)' : 'var(--fg-5)' }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: isDragActive ? 'var(--blue)' : 'var(--fg-2)', marginBottom: 6 }}>
                    {isDragActive ? 'Drop to analyze' : 'Drop audio file here'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fg-5)' }}>WAV · MP3 · FLAC · OGG · M4A — up to 100MB</div>
                </>
              )}
            </div>
          </Reveal>

          {/* Waveform */}
          {fileUrl && !analyzing && (
            <Reveal delay={0.04}>
              <WaveformVisualizer url={fileUrl} height={72} showControls className="" />
            </Reveal>
          )}

          {/* Analyzing state */}
          {analyzing && (
            <Reveal>
              <div className="card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <WaveBars color="var(--blue)" bars={18} height={40} active />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>Analyzing audio…</div>
                <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>Computing SNR, speech activity, spectral metrics, and quality score</div>
              </div>
            </Reveal>
          )}

          {/* Results */}
          {result && !analyzing && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Score hero */}
              <div className="card" style={{ padding: 28, borderColor: suitCfg?.color ? `color-mix(in srgb, ${suitCfg.color} 25%, transparent)` : undefined, background: suitCfg?.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
                  <QualityGauge score={result.quality_score} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {suitCfg && <suitCfg.icon size={18} style={{ color: suitCfg.color }} />}
                      <span style={{ fontSize: 20, fontWeight: 700, color: suitCfg?.color ?? 'var(--fg)', letterSpacing: '-0.02em' }}>{suitCfg?.label ?? result.suitability} Quality</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--fg-3)', lineHeight: 1.6, marginBottom: 12 }}>
                      {result.quality_score >= 80
                        ? 'This audio is excellent for voice cloning and TTS synthesis. Clear speech, good SNR, and minimal background noise detected.'
                        : result.quality_score >= 60
                        ? 'This audio is acceptable for voice cloning with minor limitations. Review recommendations below to improve results.'
                        : 'This audio has quality issues that may affect cloning accuracy. Address the issues listed below before cloning.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: `color-mix(in srgb, ${suitCfg?.color} 10%, transparent)`, color: suitCfg?.color, fontWeight: 700 }}>
                        {result.suitability} for cloning
                      </span>
                      <span className="badge badge-gray">{result.format?.toUpperCase()}</span>
                      <span className="badge badge-gray">{result.sample_rate?.toLocaleString()} Hz</span>
                      <span className="badge badge-gray">{result.channels === 1 ? 'Mono' : 'Stereo'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Acoustic Metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <MetricCard label="SNR" value={result.snr_db} unit="dB" icon={Activity}
                    color={result.snr_db >= 30 ? '#16a34a' : result.snr_db >= 15 ? '#d97706' : '#dc2626'}
                    tooltip="Signal-to-noise ratio. 30dB+ is ideal." />
                  <MetricCard label="RMS Level" value={result.rms_db} unit="dB" icon={Volume2} tooltip="Average signal loudness." />
                  <MetricCard label="Peak Level" value={result.peak_db} unit="dB" icon={BarChart2}
                    color={result.peak_db > -1 ? '#dc2626' : 'var(--fg-2)'} tooltip="Peak signal level. Should be < -1dB." />
                  <MetricCard label="Duration" value={result.duration_seconds} unit="sec" icon={Clock}
                    color={result.duration_seconds >= 30 ? '#16a34a' : result.duration_seconds >= 5 ? '#d97706' : '#dc2626'}
                    tooltip="Audio duration. 30-120s is optimal for cloning." />
                  <MetricCard label="Speech Ratio" value={`${(result.speech_ratio * 100).toFixed(0)}%`} unit="" icon={Mic}
                    color={result.speech_ratio >= 0.6 ? '#16a34a' : result.speech_ratio >= 0.3 ? '#d97706' : '#dc2626'}
                    tooltip="Fraction of audio containing speech. Higher is better." />
                  <MetricCard label="Sample Rate" value={result.sample_rate?.toLocaleString()} unit="Hz" icon={Zap} tooltip="Audio sample rate. 16kHz+ is acceptable." />
                </div>
              </div>

              {/* Issues & Recommendations */}
              {(result.issues?.length > 0 || result.recommendations?.length > 0) && (
                <div className="card" style={{ padding: 22 }}>
                  {result.issues?.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                        Issues ({result.issues.length})
                      </div>
                      {result.issues.map((iss, i) => <IssueItem key={i} text={iss} type="issue" />)}
                    </div>
                  )}
                  {result.recommendations?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, marginTop: result.issues?.length > 0 ? 16 : 0 }}>
                        Recommendations
                      </div>
                      {result.recommendations.map((rec, i) => <IssueItem key={i} text={rec} type="rec" />)}
                    </div>
                  )}
                </div>
              )}

              {/* Radar chart toggle */}
              <button onClick={() => setShowRadar(!showRadar)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', cursor: 'pointer', width: '100%', fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)', transition: 'all 0.12s' }}>
                <BarChart2 size={15} style={{ color: 'var(--blue)' }} />
                Quality Radar Chart
                {showRadar ? <ChevronUp size={14} style={{ marginLeft: 'auto', color: 'var(--fg-4)' }} /> : <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--fg-4)' }} />}
              </button>
              <AnimatePresence>
                {showRadar && (
                  <motion.div className="card" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', padding: 20 }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: 'var(--fg-4)' }} />
                        <Radar name="Score" dataKey="value" stroke="var(--blue)" fill="var(--blue)" fillOpacity={0.12} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Right — Tips & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Recording tips */}
          <Reveal delay={0.04}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 16 }}>Recording Tips</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {TIPS.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, borderBottom: i < TIPS.length - 1 ? '1px solid var(--border-2)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <tip.icon size={15} style={{ color: 'var(--blue)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 3 }}>{tip.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--fg-4)', lineHeight: 1.55 }}>{tip.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Quality benchmark reference */}
          <Reveal delay={0.06}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Quality Reference</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { range: '80–100', label: 'Excellent', desc: 'Perfect for cloning', color: '#16a34a' },
                  { range: '60–79', label: 'Good', desc: 'Works well', color: '#65a30d' },
                  { range: '40–59', label: 'Fair', desc: 'May affect similarity', color: '#d97706' },
                  { range: '0–39', label: 'Poor', desc: 'Likely to fail', color: '#dc2626' },
                ].map(r => (
                  <div key={r.range} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `color-mix(in srgb, ${r.color} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: r.color }}>{r.range.split('–')[0]}+</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>{r.label} <span style={{ fontWeight: 400, color: 'var(--fg-4)', fontSize: 12 }}>({r.range})</span></div>
                      <div style={{ fontSize: 12, color: 'var(--fg-5)' }}>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Analysis history */}
          {history.length > 1 && (
            <Reveal delay={0.08}>
              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Session History</div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} formatter={(v: any) => [`${v.toFixed(0)}/100`, 'Quality']} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.score >= 80 ? '#16a34a' : entry.score >= 60 ? '#d97706' : '#dc2626'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {history.slice(0, 5).map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{h.file}</span>
                      <span style={{ fontWeight: 700, color: h.result.quality_score >= 80 ? '#16a34a' : h.result.quality_score >= 60 ? '#d97706' : '#dc2626', flexShrink: 0 }}>
                        {h.result.quality_score.toFixed(0)}/100
                      </span>
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
