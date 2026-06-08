import React, { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  url?: string
  audioData?: ArrayBuffer
  height?: number
  waveColor?: string
  progressColor?: string
  showControls?: boolean
  showDownload?: boolean
  downloadFilename?: string
  onReady?: (duration: number) => void
  className?: string
  highlightSegments?: Array<{ start: number; end: number; color: string }>
}

export default function WaveformVisualizer({
  url, audioData, height = 80, waveColor = '#cbd5e1', progressColor = '#3a5cf7',
  showControls = true, showDownload = false, downloadFilename, onReady, className,
  highlightSegments = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height, waveColor, progressColor,
      barWidth: 2, barGap: 1, barRadius: 2,
      normalize: true, interact: showControls,
    })

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      setReady(true)
      setLoading(false)
      onReady?.(ws.getDuration())
    })
    ws.on('timeupdate', (t) => setCurrentTime(t))
    ws.on('finish', () => setPlaying(false))
    ws.on('error', () => setLoading(false))

    if (url) ws.load(url)
    else if (audioData) ws.loadBlob(new Blob([audioData]))

    wsRef.current = ws
    return () => { ws.destroy(); wsRef.current = null }
  }, [url])

  const togglePlay = async () => {
    try {
      if (wsRef.current) {
        if (playing) {
          wsRef.current.pause()
          setPlaying(false)
        } else {
          await wsRef.current.play()
          setPlaying(true)
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Playback error:', e)
      }
    }
  }

  const toggleMute = () => {
    if (wsRef.current) {
      wsRef.current.setMuted(!muted)
      setMuted(m => !m)
    }
  }

  const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`

  return (
    <div className={clsx('bg-surface-50 rounded-xl p-4 border border-surface-200', className)}>
      {/* Waveform */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-50 rounded-lg z-10">
            <div className="flex gap-1">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-1 rounded-full bg-brand-300 animate-wave"
                  style={{ height: `${20 + Math.random()*20}px`, animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={containerRef} className="overflow-hidden" />

        {/* Highlight segments overlay */}
        {ready && highlightSegments.map((seg, i) => {
          const pctStart = (seg.start / duration) * 100
          const pctWidth = ((seg.end - seg.start) / duration) * 100
          return (
            <div key={i} className="absolute top-0 bottom-0 opacity-20 rounded"
              style={{ left: `${pctStart}%`, width: `${pctWidth}%`, background: seg.color }} />
          )
        })}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex items-center gap-3 mt-3">
          <button onClick={togglePlay} disabled={!ready}
            className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-all disabled:opacity-50 flex-shrink-0">
            {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <div className="text-xs font-mono text-surface-500 flex-shrink-0 tabular-nums">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </div>
          <div className="flex-1" />
          <button onClick={toggleMute} className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 transition-all">
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          {showDownload && url && (
            <a href={url} download={downloadFilename || 'audio.wav'}
              className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 transition-all">
              <Download size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
