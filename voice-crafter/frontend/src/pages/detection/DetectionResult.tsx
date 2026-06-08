import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Download, ChevronLeft, FileText, User, Clock, Hash } from 'lucide-react'
import { detectionApi, getErrorMessage } from '@/api/client'
import { Reveal, VerdictBadge, StatusBadge, Spinner } from '@/components/ui/shared'
import WaveformVisualizer from '@/components/audio/WaveformVisualizer'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import toast from 'react-hot-toast'

function ModelScoreRow({ name, score }: { name: string; score?: number }) {
  const v = score ?? 0
  const color = v >= 0.65 ? 'var(--red)' : v >= 0.4 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{name}</div>
      <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }}
          style={{ height: '100%', borderRadius: 99, background: color }} />
      </div>
      <div style={{ width: 38, fontSize: 12.5, fontWeight: 700, textAlign: 'right', color, flexShrink: 0 }}>{(v * 100).toFixed(0)}%</div>
    </div>
  )
}

export default function DetectionResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [exporting, setExporting] = useState(false)
  const pollRef = React.useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!id) return
    loadJob()
  }, [id])

  const loadJob = async () => {
    try {
      const data = await detectionApi.getJob(id!)
      setJob(data)
      setNotes(data.analyst_notes || '')
      if (data.status === 'processing' || data.status === 'queued') {
        pollRef.current = setInterval(async () => {
          const updated = await detectionApi.getJob(id!).catch(() => null)
          if (updated) {
            setJob(updated)
            if (updated.status === 'completed' || updated.status === 'failed') {
              clearInterval(pollRef.current)
            }
          }
        }, 2000)
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => { clearInterval(pollRef.current) }, [])

  const saveNotes = async () => {
    if (!id) return
    setSavingNotes(true)
    try {
      await detectionApi.updateNotes(id, notes)
      toast.success('Notes saved')
    } catch { toast.error('Failed to save notes') }
    finally { setSavingNotes(false) }
  }

  const exportJson = async () => {
    if (!id) return
    setExporting(true)
    try {
      const blob = await detectionApi.exportJson(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `detection_${id}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <Spinner size={24} />
    </div>
  )
  if (!job) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-4)' }}>Detection job not found.</div>
  )

  const isSynthetic = job.is_synthetic
  const accentColor = isSynthetic ? 'var(--red)' : 'var(--green)'
  const timelineData = (job.confidence_timeline || []).map((p: any) => ({ t: p.t, score: p.score }))

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back + actions */}
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button onClick={() => navigate('/detection')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--fg-3)', transition: 'all 0.12s' }}>
            <ChevronLeft size={14} /> Back to Detection Lab
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportJson} disabled={exporting || job.status !== 'completed'} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              {exporting ? <Spinner size={12} /> : <Download size={13} />} Export JSON
            </button>
            <Link to={`/detection/${id}/evidence`} className="btn btn-outline btn-sm" style={{ gap: 6 }}>
              <FileText size={13} /> Evidence Report
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Verdict hero */}
      <Reveal delay={0.04}>
        <div className="card" style={{ padding: 28, marginBottom: 20, borderColor: isSynthetic ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)', background: isSynthetic ? 'rgba(220,38,38,0.02)' : 'rgba(22,163,74,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={26} style={{ color: accentColor }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <VerdictBadge verdict={job.verdict} />
                <StatusBadge status={job.status} />
              </div>
              {job.explanation && (
                <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.65, marginBottom: 12, maxWidth: 680 }}>{job.explanation}</p>
              )}
              {job.flagged_reasons?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {job.flagged_reasons.map((r: string) => (
                    <span key={r} className="badge badge-red" style={{ fontSize: 11 }}>{r.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: accentColor, lineHeight: 1, letterSpacing: '-0.04em' }}>
                {((job.ensemble_confidence ?? 0) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 4 }}>ensemble confidence</div>
            </div>
          </div>
        </div>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Confidence timeline */}
          <Reveal delay={0.06}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 18 }}>Confidence Timeline</div>
              {timelineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={timelineData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
                    <XAxis dataKey="t" tickFormatter={(v: number) => `${v.toFixed(1)}s`} tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'var(--fg-5)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                      formatter={(v: any) => [`${(v*100).toFixed(1)}%`, 'Risk']}
                      labelFormatter={(l: any) => `${parseFloat(l).toFixed(2)}s`} />
                    <ReferenceLine y={0.65} stroke="var(--red)" strokeDasharray="4 2" strokeWidth={1} />
                    <Area type="monotone" dataKey="score" stroke="var(--blue)" fill="url(#confGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-5)', fontSize: 13.5 }}>No timeline data</div>
              )}
            </div>
          </Reveal>

          {/* Model scores */}
          <Reveal delay={0.08}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 18 }}>Per-Model Scores</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ModelScoreRow name="AASIST"   score={job.model_scores?.aasist} />
                <ModelScoreRow name="RawNet2"  score={job.model_scores?.rawnet2} />
                <ModelScoreRow name="Prosodic" score={job.model_scores?.prosodic} />
                <ModelScoreRow name="Spectral" score={job.model_scores?.spectral} />
                <ModelScoreRow name="Glottal"  score={job.model_scores?.glottal} />
              </div>
            </div>
          </Reveal>

          {/* Suspicious segments */}
          {job.suspicious_segments?.length > 0 && (
            <Reveal delay={0.1}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 14 }}>
                  Suspicious Segments ({job.suspicious_segments.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {job.suspicious_segments.slice(0, 10).map((seg: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.04)', borderRadius: 10, border: '1px solid rgba(220,38,38,0.1)' }}>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--red)', fontWeight: 600, minWidth: 130 }}>
                        {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--fg-4)' }}>
                        {seg.reasons?.slice(0, 3).map((r: string) => r.replace(/_/g, ' ')).join(' · ')}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{(seg.score * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {/* Speaker diarization */}
          {job.speakers?.length > 0 && (
            <Reveal delay={0.12}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 14 }}>Speaker Analysis</div>
                {job.speakers.map((sp: any) => (
                  <div key={sp.speaker_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border-2)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} style={{ color: 'var(--fg-4)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)' }}>{sp.speaker_id}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>
                        {sp.total_duration?.toFixed(1)}s · {sp.segments?.length || 0} segments
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: sp.max_synthetic_score >= 0.65 ? 'var(--red)' : 'var(--green)' }}>
                        {(sp.max_synthetic_score * 100).toFixed(0)}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{sp.synthetic_segments} suspicious</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* Analyst notes */}
          <Reveal delay={0.14}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 12 }}>Analyst Notes</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input textarea" rows={4} placeholder="Add your analysis notes, observations, or case context here…" style={{ marginBottom: 10 }} />
              <button onClick={saveNotes} disabled={savingNotes} className="btn btn-secondary btn-sm">
                {savingNotes ? <Spinner size={12} /> : 'Save Notes'}
              </button>
            </div>
          </Reveal>
        </div>

        {/* Right: Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Reveal delay={0.06}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Job Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'File', value: job.original_filename || '—', mono: true },
                  { label: 'Duration', value: job.duration_seconds ? `${job.duration_seconds.toFixed(2)}s` : '—' },
                  { label: 'Processing', value: job.processing_time_ms ? `${job.processing_time_ms}ms` : '—' },
                  { label: 'Threshold', value: `${((job.confidence_threshold ?? 0.65) * 100).toFixed(0)}%` },
                  { label: 'Diarization', value: job.diarization_completed ? 'Completed' : 'Not run' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--fg-4)', flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--fg-2)', fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Hash size={14} style={{ color: 'var(--fg-4)' }} /> Chain of Custody
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(job.chain_of_custody || []).map((entry: any, i: number) => (
                  <div key={i} style={{ padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--fg-4)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg-2)', marginBottom: 2 }}>{entry.event?.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--fg-5)' }}>{entry.timestamp?.slice(0, 19).replace('T', ' ')}</div>
                  </div>
                ))}
              </div>
              {job.evidence_hash && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 4 }}>Evidence Hash (SHA-256)</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--fg-3)', wordBreak: 'break-all' }}>{job.evidence_hash}</div>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 14 }}>Model Versions</div>
              {Object.entries(job.model_versions || {}).map(([name, ver]: [string, any]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--border-2)' }}>
                  <span style={{ color: 'var(--fg-4)', textTransform: 'uppercase', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>{name}</span>
                  <span style={{ color: 'var(--fg-2)', fontFamily: 'monospace', fontSize: 11.5 }}>v{ver}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
