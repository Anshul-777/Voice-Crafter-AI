import React, { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Shield, Upload, FileAudio, X, Sliders, ChevronDown, Play, Activity } from 'lucide-react'
import { detectionApi, getErrorMessage } from '@/api/client'
import { Spinner, VerdictBadge, StatusBadge } from '@/components/ui/index'
import ConfidenceTimeline from '@/components/charts/ConfidenceTimeline'
import WaveformVisualizer from '@/components/audio/WaveformVisualizer'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Link } from 'react-router-dom'

function ModelScoreBar({ name, score }: { name: string; score?: number }) {
  if (score === undefined || score === null) return null
  const pct = Math.round(score * 100)
  const color = score >= 0.65 ? 'bg-danger-500' : score >= 0.4 ? 'bg-warning-500' : 'bg-success-500'
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs font-600 text-surface-600 uppercase tracking-wide flex-shrink-0">{name}</div>
      <div className="flex-1 h-2 rounded-full bg-surface-100 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <div className={clsx('text-sm font-800 w-10 text-right tabular-nums',
        score >= 0.65 ? 'text-danger-600' : score >= 0.4 ? 'text-warning-600' : 'text-success-600')}>
        {pct}%
      </div>
    </div>
  )
}

export default function DetectionLab() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [threshold, setThreshold] = useState(0.65)
  const [diarization, setDiarization] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const pollRef = useRef<NodeJS.Timeout>()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'audio/*': ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.webm'] },
    maxFiles: 1,
    onDrop: useCallback((files: File[]) => {
      if (files[0]) {
        setFile(files[0])
        setFileUrl(URL.createObjectURL(files[0]))
        setResult(null)
      }
    }, []),
  })

  const startAnalysis = async () => {
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const data = await detectionApi.analyze(
        file,
        { confidence_threshold: threshold, enable_diarization: diarization },
        (pct) => setUploadProgress(pct)
      )
      setPollingJobId(data.job_id)
      toast.success('Detection job queued! Analyzing…')
      startPolling(data.job_id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const startPolling = (jobId: string) => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const data = await detectionApi.getJob(jobId)
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current)
          setPollingJobId(null)
          setResult(data)
          if (data.status === 'completed') {
            toast.success('Detection complete!')
          } else {
            toast.error(`Detection failed: ${data.error_message || 'Unknown error'}`)
          }
        }
      } catch {}
    }, 2000)
  }

  const isProcessing = uploading || !!pollingJobId

  return (
    <div className="p-6 lg:p-8 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-800 text-surface-900 flex items-center gap-2">
            <Shield size={24} className="text-danger-500" /> Detection Lab
          </h1>
          <p className="text-surface-500 text-sm mt-1">Upload audio for multi-model deepfake analysis. Results include segment timeline, model scores, and evidence export.</p>
        </div>
        <Link to="/detection/live" className="btn-secondary flex items-center gap-2">
          <Activity size={16} /> Live Detection
        </Link>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drop zone */}
          <div {...getRootProps()} className={clsx(
            'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragActive ? 'border-brand-400 bg-brand-50' : 'border-surface-200 hover:border-brand-300 hover:bg-surface-50',
            file && 'border-brand-300 bg-brand-50/50'
          )}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {file ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
                    <FileAudio size={24} className="text-brand-600" />
                  </div>
                  <div className="text-sm font-600 text-surface-800">{file.name}</div>
                  <div className="text-xs text-surface-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setFileUrl(null); setResult(null) }}
                    className="text-xs text-danger-500 hover:text-danger-600 flex items-center gap-1 mt-1">
                    <X size={12} /> Remove file
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center">
                    <Upload size={24} className="text-surface-400" />
                  </div>
                  <div className="text-sm font-700 text-surface-700">Drop audio file here</div>
                  <div className="text-xs text-surface-400">WAV, MP3, FLAC, OGG, M4A, WebM — up to 200MB</div>
                </>
              )}
            </div>
          </div>

          {/* Waveform preview */}
          {fileUrl && (
            <WaveformVisualizer url={fileUrl} height={60} showControls />
          )}

          {/* Advanced settings */}
          <div className="card p-4">
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-sm font-600 text-surface-700">
              <span className="flex items-center gap-2"><Sliders size={15} /> Detection Settings</span>
              <ChevronDown size={14} className={clsx('transition-transform', showAdvanced && 'rotate-180')} />
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="label mb-0">Confidence Threshold</span>
                    <span className="font-700 text-brand-600">{(threshold * 100).toFixed(0)}%</span>
                  </div>
                  <input type="range" min={30} max={95} value={threshold * 100}
                    onChange={e => setThreshold(+e.target.value / 100)} className="w-full" />
                  <div className="flex justify-between text-[10px] text-surface-400 mt-1">
                    <span>More sensitive</span><span>More specific</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-600 text-surface-700">Speaker Diarization</div>
                    <div className="text-[10px] text-surface-400">Separate detection per speaker</div>
                  </div>
                  <button onClick={() => setDiarization(!diarization)}
                    className={clsx('w-10 h-5.5 rounded-full transition-all duration-200 relative flex-shrink-0',
                      diarization ? 'bg-brand-500' : 'bg-surface-200')}>
                    <div className={clsx('absolute w-4 h-4 bg-white rounded-full top-0.5 transition-all duration-200 shadow-sm',
                      diarization ? 'left-5.5' : 'left-0.5')} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Analyze button */}
          <button onClick={startAnalysis} disabled={!file || isProcessing}
            className="btn-primary w-full py-3.5 text-base disabled:opacity-50">
            {uploading ? (
              <><Spinner size={18} /> Uploading… {uploadProgress}%</>
            ) : pollingJobId ? (
              <><Spinner size={18} /> Analyzing audio…</>
            ) : (
              <><Shield size={18} /> Run Detection Analysis</>
            )}
          </button>

          {/* Upload progress */}
          {uploading && (
            <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="lg:col-span-3 space-y-5">
          {!result && !isProcessing && (
            <div className="card p-12 text-center border-2 border-dashed border-surface-200">
              <Shield size={40} className="text-surface-300 mx-auto mb-4" />
              <div className="text-surface-500 font-600 text-base mb-1">Upload audio to begin analysis</div>
              <div className="text-surface-400 text-sm">5-model ensemble will analyze the audio and return a detailed report with segment-level confidence scores.</div>
            </div>
          )}

          {isProcessing && (
            <div className="card p-10 text-center">
              <div className="flex justify-center mb-6">
                <div className="flex gap-1 items-center h-12">
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="w-1.5 rounded-full bg-brand-400 animate-wave"
                      style={{ height: `${16 + Math.sin(i)*10}px`, animationDelay: `${i*0.1}s` }} />
                  ))}
                </div>
              </div>
              <div className="text-base font-700 text-surface-800 mb-1">Analyzing audio…</div>
              <div className="text-sm text-surface-500">Running AASIST · RawNet2 · Prosodic · Spectral · Glottal</div>
            </div>
          )}

          {result && result.status === 'completed' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Verdict */}
              <div className={clsx('card p-6 border-2', result.is_synthetic ? 'border-danger-200 bg-danger-50/30' : 'border-success-200 bg-success-50/30')}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs font-700 text-surface-500 uppercase tracking-wide mb-1">Detection Verdict</div>
                    <VerdictBadge verdict={result.verdict} />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-800" style={{ color: result.is_synthetic ? '#ef4444' : '#22c55e' }}>
                      {((result.ensemble_confidence || 0) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-surface-500 font-500">ensemble confidence</div>
                  </div>
                </div>
                {result.explanation && (
                  <p className="text-sm text-surface-600 leading-relaxed bg-white/70 rounded-xl p-3 border border-surface-200">
                    {result.explanation}
                  </p>
                )}
                {result.flagged_reasons?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.flagged_reasons.map((r: string) => (
                      <span key={r} className="text-[11px] bg-danger-100 text-danger-700 font-600 px-2 py-0.5 rounded-md">
                        {r.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Scores */}
              <div className="card p-5">
                <div className="text-sm font-700 text-surface-800 mb-4">Per-Model Scores</div>
                <div className="space-y-3">
                  <ModelScoreBar name="AASIST" score={result.model_scores?.aasist} />
                  <ModelScoreBar name="RawNet2" score={result.model_scores?.rawnet2} />
                  <ModelScoreBar name="Prosodic" score={result.model_scores?.prosodic} />
                  <ModelScoreBar name="Spectral" score={result.model_scores?.spectral} />
                  <ModelScoreBar name="Glottal" score={result.model_scores?.glottal} />
                </div>
              </div>

              {/* Confidence Timeline */}
              <ConfidenceTimeline timeline={result.confidence_timeline} threshold={threshold} />

              {/* Suspicious segments */}
              {result.suspicious_segments?.length > 0 && (
                <div className="card p-5">
                  <div className="text-sm font-700 text-surface-800 mb-3 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-danger-500" />
                    Suspicious Segments ({result.suspicious_segments.length})
                  </div>
                  <div className="space-y-2">
                    {result.suspicious_segments.slice(0, 8).map((seg: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 bg-danger-50/50 rounded-lg border border-danger-100">
                        <span className="text-xs font-700 text-danger-700 font-mono">
                          {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                        </span>
                        <span className="text-xs font-800 text-danger-600">{(seg.score * 100).toFixed(1)}%</span>
                        <span className="flex-1 text-[11px] text-surface-500">{seg.reasons?.slice(0,2).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Speaker info */}
              {result.speakers?.length > 0 && (
                <div className="card p-5">
                  <div className="text-sm font-700 text-surface-800 mb-3">Speaker Analysis</div>
                  {result.speakers.map((sp: any) => (
                    <div key={sp.speaker_id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl mb-2">
                      <div>
                        <div className="text-sm font-600 text-surface-800">{sp.speaker_id}</div>
                        <div className="text-xs text-surface-500">{sp.total_duration?.toFixed(1)}s · {sp.segments?.length} segments</div>
                      </div>
                      <div className="text-right">
                        <div className={clsx('text-sm font-800', sp.max_synthetic_score >= threshold ? 'text-danger-600' : 'text-success-600')}>
                          {(sp.max_synthetic_score * 100).toFixed(0)}%
                        </div>
                        <div className="text-[11px] text-surface-400">{sp.synthetic_segments} synthetic segments</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => { navigate(`/detection/${result.job_id}`) }} className="btn-secondary flex-1">
                  View Full Report
                </button>
                <button onClick={async () => {
                  try {
                    const blob = await detectionApi.exportJson(result.job_id)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = `detection_${result.job_id}.json`; a.click()
                  } catch { toast.error('Export failed') }
                }} className="btn-outline">Export JSON</button>
              </div>
            </motion.div>
          )}

          {result?.status === 'failed' && (
            <div className="card p-8 text-center border-danger-200 border-2">
              <X size={32} className="text-danger-500 mx-auto mb-3" />
              <div className="font-700 text-surface-900 mb-1">Detection Failed</div>
              <div className="text-sm text-surface-500">{result.error_message}</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent detections */}
      <RecentDetections />
    </div>
  )
}

function AlertTriangle({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  )
}

function RecentDetections() {
  const [jobs, setJobs] = useState<any[]>([])
  useEffect(() => {
    detectionApi.list({ page: 1, page_size: 5 }).then(d => setJobs(d.jobs || [])).catch(() => {})
  }, [])

  if (!jobs.length) return null

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-700 text-surface-900">Recent Detections</h3>
        <Link to="/history" className="text-xs text-brand-600 font-600">View all</Link>
      </div>
      <div className="space-y-2">
        {jobs.map(j => (
          <Link key={j.id} to={`/detection/${j.id}`}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-50 transition-all group">
            <VerdictBadge verdict={j.verdict} />
            <span className="text-sm text-surface-600 flex-1 truncate">{j.original_filename || 'Unknown file'}</span>
            <span className="text-xs text-surface-400">{j.duration_seconds?.toFixed(1)}s</span>
            <StatusBadge status={j.status} />
          </Link>
        ))}
      </div>
    </div>
  )
}

function useEffect(fn: () => void | (() => void), deps: any[]) {
  React.useEffect(fn, deps)
}

function useState<T>(init: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return React.useState(init)
}
