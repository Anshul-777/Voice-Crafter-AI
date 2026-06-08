import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Upload, FileAudio, Plus, Check, AlertTriangle, ChevronDown, RefreshCw, Mic, X } from 'lucide-react'
import { voicesApi, cloningApi, qualityApi, getErrorMessage } from '@/api/client'
import { Reveal, StaggerGroup, StaggerItem, StatusBadge, WaveBars, PageHeader, Spinner, EmptyState } from '@/components/ui/shared'
import toast from 'react-hot-toast'

const QUALITY_COLOR = (s: number) => s >= 75 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red)'

export default function ClonePage() {
  const [step, setStep]           = useState<1|2|3>(1)
  const [voices, setVoices]       = useState<any[]>([])
  const [selectedVoice, setVoice] = useState('')
  const [newVoiceName, setNewVoiceName] = useState('')
  const [mode, setMode]           = useState<'zero_shot'|'fine_tune'>('zero_shot')
  const [samples, setSamples]     = useState<File[]>([])
  const [quality, setQuality]     = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [jobs, setJobs]           = useState<any[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [creatingVoice, setCreatingVoice] = useState(false)
  const pollRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    voicesApi.list({ page_size: 50 }).then(d => setVoices(d.voices || [])).catch(() => {})
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setJobsLoading(true)
    cloningApi.listJobs({ page_size: 10 }).then(d => setJobs(d.jobs || [])).catch(() => {}).finally(() => setJobsLoading(false))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'audio/*': ['.wav','.mp3','.flac','.ogg','.m4a','.webm'] },
    onDrop: useCallback(async (files: File[]) => {
      const f = files[0]
      if (!f) return
      setSamples(prev => [...prev, f])
      setAnalyzing(true); setQuality(null)
      try {
        const q = await qualityApi.analyze(f)
        setQuality(q)
      } catch { setQuality(null) }
      finally { setAnalyzing(false) }
    }, []),
  })

  const createVoiceAndContinue = async () => {
    if (!newVoiceName.trim()) { toast.error('Enter a voice profile name'); return }
    setCreatingVoice(true)
    try {
      const v = await voicesApi.create({ name: newVoiceName.trim(), visibility: 'private', consent_verified: true })
      setVoices(prev => [v, ...prev])
      setVoice(v.id)
      setStep(2)
      toast.success(`Voice profile "${v.name}" created`)
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setCreatingVoice(false) }
  }

  const uploadSamples = async () => {
    if (!selectedVoice || samples.length === 0) { toast.error('Select a voice and upload at least one sample'); return }
    for (const file of samples) {
      try {
        await cloningApi.uploadSample(selectedVoice, file)
      } catch (err) { toast.error(`Upload failed for ${file.name}: ${getErrorMessage(err)}`); return }
    }
    setStep(3)
    toast.success('Samples uploaded')
  }

  const startClone = async () => {
    if (!selectedVoice) { toast.error('No voice selected'); return }
    setSubmitting(true)
    try {
      const data = await cloningApi.startJob({ voice_profile_id: selectedVoice, mode })
      toast.success('Clone job started!')
      pollJob(data.job_id)
      setStep(1); setVoice(''); setSamples([]); setQuality(null)
      loadJobs()
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSubmitting(false) }
  }

  const pollJob = (jobId: string) => {
    if (pollRef.current.has(jobId)) return
    const interval = setInterval(async () => {
      const data = await cloningApi.getJob(jobId).catch(() => null)
      if (!data) return
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...data } : j))
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval)
        pollRef.current.delete(jobId)
        if (data.status === 'completed') toast.success('Voice clone ready!')
        else toast.error(`Clone failed: ${data.error_message}`)
      }
    }, 2000)
    pollRef.current.set(jobId, interval)
  }

  const removeSample = (idx: number) => setSamples(prev => prev.filter((_, i) => i !== idx))
  const selectedV = voices.find(v => v.id === selectedVoice)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon={Zap} title="Clone Voice" description="Upload voice samples and create a cloned voice profile using XTTS-v2." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Left: Steps */}
        <div>
          {/* Step 1: Profile */}
          <Reveal>
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <StepHeader n={1} title="Voice Profile" done={!!selectedVoice} active={step >= 1} />
              <div style={{ marginTop: 18 }}>
                {voices.length > 0 && (
                  <>
                    <label className="label">Select existing profile</label>
                    <select value={selectedVoice} onChange={e => { setVoice(e.target.value); setStep(2) }} className="input select" style={{ marginBottom: 14 }}>
                      <option value="">— Choose voice profile —</option>
                      {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--fg-4)', fontSize: 12 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />OR<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  </>
                )}
                <label className="label">Create new profile</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newVoiceName} onChange={e => setNewVoiceName(e.target.value)} placeholder="e.g. My Voice, Brand Voice…" className="input" onKeyDown={e => e.key === 'Enter' && createVoiceAndContinue()} />
                  <button onClick={createVoiceAndContinue} disabled={creatingVoice || !newVoiceName.trim()} className="btn btn-secondary" style={{ flexShrink: 0, gap: 5 }}>
                    {creatingVoice ? <Spinner size={14} /> : <><Plus size={14} />Create</>}
                  </button>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Step 2: Upload samples */}
          <Reveal delay={0.05}>
            <div className="card" style={{ padding: 24, marginBottom: 16, opacity: step >= 2 ? 1 : 0.5, pointerEvents: step >= 2 ? 'all' : 'none' }}>
              <StepHeader n={2} title="Upload Audio Samples" done={samples.length > 0} active={step >= 2} />
              <div style={{ marginTop: 18 }}>
                {/* Dropzone */}
                <div {...getRootProps()} style={{
                  border: `2px dashed ${isDragActive ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                  background: isDragActive ? 'var(--blue-soft)' : 'var(--bg-2)',
                  transition: 'all 0.14s ease',
                }}>
                  <input {...getInputProps()} />
                  <Upload size={24} style={{ color: isDragActive ? 'var(--blue)' : 'var(--fg-5)', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDragActive ? 'var(--blue)' : 'var(--fg-2)', marginBottom: 4 }}>
                    {isDragActive ? 'Drop to upload' : 'Drag audio files here'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>WAV · MP3 · FLAC · OGG · M4A — min 3s, max 5min</div>
                </div>

                {/* Sample list */}
                {samples.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {samples.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border-2)' }}>
                        <FileAudio size={16} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{(f.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button onClick={() => removeSample(i)} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-4)', display: 'flex', borderRadius: 6 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quality analysis result */}
                {analyzing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginTop: 12, background: 'var(--bg-2)', borderRadius: 10, fontSize: 13, color: 'var(--fg-3)' }}>
                    <Spinner size={14} /> Analyzing audio quality…
                  </div>
                )}
                {quality && !analyzing && (
                  <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, border: `1px solid ${quality.quality_score >= 50 ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`, background: quality.quality_score >= 50 ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>Quality Analysis</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: QUALITY_COLOR(quality.quality_score) }}>{quality.quality_score?.toFixed(0)}</span>
                        <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>/100</span>
                        <span className={`badge ${quality.quality_score >= 50 ? 'badge-green' : 'badge-red'}`}>{quality.suitability}</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
                      {[
                        ['Duration', `${quality.duration_seconds?.toFixed(1)}s`],
                        ['SNR', `${quality.snr_db?.toFixed(1)} dB`],
                        ['Speech ratio', `${(quality.speech_ratio * 100)?.toFixed(0)}%`],
                        ['Sample rate', `${quality.sample_rate?.toLocaleString()} Hz`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-4)' }}>
                          <span>{k}</span><span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {quality.issues?.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--red)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                        {quality.issues.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                {samples.length > 0 && (
                  <button onClick={uploadSamples} className="btn btn-primary" style={{ marginTop: 14, width: '100%' }}>
                    <Check size={14} /> Continue to Cloning
                  </button>
                )}
              </div>
            </div>
          </Reveal>

          {/* Step 3: Clone settings */}
          <Reveal delay={0.1}>
            <div className="card" style={{ padding: 24, opacity: step >= 3 ? 1 : 0.5, pointerEvents: step >= 3 ? 'all' : 'none' }}>
              <StepHeader n={3} title="Clone Settings" done={false} active={step >= 3} />
              <div style={{ marginTop: 18 }}>
                <label className="label">Clone mode</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {[
                    { id: 'zero_shot', label: 'Zero-shot', desc: 'Fast · Uses reference audio directly' },
                    { id: 'fine_tune', label: 'Fine-tune', desc: 'Slower · Higher voice similarity · Pro plan' },
                  ].map(m => (
                    <button key={m.id} onClick={() => setMode(m.id as any)}
                      style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${mode === m.id ? 'var(--blue)' : 'var(--border)'}`, background: mode === m.id ? 'var(--blue-soft)' : 'var(--bg)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.14s' }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: mode === m.id ? 'var(--blue)' : 'var(--fg-2)', marginBottom: 3 }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.4 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>

                {selectedV && (
                  <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--fg-3)' }}>
                    Cloning into: <strong style={{ color: 'var(--fg-2)' }}>{selectedV.name}</strong>
                    {' · '}{samples.length} sample{samples.length !== 1 ? 's' : ''}
                  </div>
                )}

                <button onClick={startClone} disabled={submitting || !selectedVoice} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                  {submitting ? <><Spinner size={16} /> Starting…</> : <><Zap size={16} /> Start Voice Clone</>}
                </button>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right: Job history */}
        <div>
          <Reveal delay={0.08}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Recent Clone Jobs
                <button onClick={loadJobs} style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-4)', display: 'flex', borderRadius: 6 }}>
                  <RefreshCw size={13} />
                </button>
              </div>
              {jobsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
                </div>
              ) : jobs.length === 0 ? (
                <EmptyState icon={Mic} title="No clone jobs yet" description="Start your first voice clone above." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jobs.map(job => (
                    <CloneJobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

function StepHeader({ n, title, done, active }: { n: number; title: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12.5, fontWeight: 700, flexShrink: 0,
        background: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--bg-3)',
        color: done || active ? 'white' : 'var(--fg-4)',
      }}>
        {done ? <Check size={13} /> : n}
      </div>
      <span style={{ fontWeight: 600, fontSize: 14.5, color: active ? 'var(--fg)' : 'var(--fg-4)' }}>{title}</span>
    </div>
  )
}

function CloneJobCard({ job }: { job: any }) {
  return (
    <div style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <StatusBadge status={job.status} />
        <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{job.mode}</span>
      </div>
      {(job.status === 'processing' || job.status === 'queued') && (
        <div className="progress" style={{ marginBottom: 6 }}>
          <div className="progress-fill" style={{ width: `${(job.progress || 0) * 100}%` }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-4)' }}>
        <span>{job.quality_score ? `Quality: ${(job.quality_score * 100).toFixed(0)}%` : job.progress_message || 'Waiting…'}</span>
        <span>{new Date(job.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
