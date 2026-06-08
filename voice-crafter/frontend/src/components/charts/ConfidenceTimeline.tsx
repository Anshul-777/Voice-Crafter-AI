import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface ConfidencePoint { t: number; score: number; verdict: string }

interface Props {
  timeline: ConfidencePoint[]
  threshold?: number
  height?: number
  showSegments?: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const score = d.score
  const color = score >= 0.65 ? '#ef4444' : score >= 0.4 ? '#f97316' : '#22c55e'
  return (
    <div className="bg-white border border-surface-200 rounded-xl p-3 shadow-lg text-xs">
      <div className="font-600 text-surface-700 mb-1">{`t = ${d.t.toFixed(2)}s`}</div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-surface-600">Score:</span>
        <span className="font-700" style={{ color }}>{(score * 100).toFixed(1)}%</span>
      </div>
      <div className="text-surface-500 mt-1">{d.verdict?.replace(/_/g, ' ')}</div>
    </div>
  )
}

export default function ConfidenceTimeline({ timeline, threshold = 0.65, height = 160, showSegments = true }: Props) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-surface-50 rounded-xl border border-surface-200 text-surface-400 text-sm">
        No timeline data available
      </div>
    )
  }

  const data = timeline.map(p => ({
    ...p,
    fill: p.score >= threshold ? 'rgba(239,68,68,0.15)' : p.score >= 0.4 ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
  }))

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-600 text-surface-700">Confidence Timeline</div>
        <div className="flex items-center gap-4 text-xs text-surface-500">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success-500" />Authentic</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-warning-500" />Uncertain</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-danger-500" />Suspicious</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3a5cf7" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3a5cf7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="t" tickFormatter={v => `${v.toFixed(0)}s`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5}
            label={{ value: 'Threshold', position: 'right', fontSize: 10, fill: '#ef4444' }} />
          <ReferenceLine y={0.4} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1} />
          <Area type="monotone" dataKey="score" stroke="#3a5cf7" strokeWidth={2} fill="url(#scoreGrad)"
            dot={(props: any) => {
              const { cx, cy, payload } = props
              const color = payload.score >= threshold ? '#ef4444' : payload.score >= 0.4 ? '#f97316' : '#22c55e'
              return <circle key={props.key} cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1.5} />
            }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
