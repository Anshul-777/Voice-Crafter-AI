import React, { useState } from 'react'
import { Code, Copy, Check, ChevronDown, ChevronRight, Key, Zap, Shield, Wand2, Globe, Activity } from 'lucide-react'
import { Reveal, StaggerGroup, StaggerItem } from '@/components/ui/shared'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const ENDPOINTS = [
  {
    group: 'Authentication',
    icon: Key,
    color: 'var(--blue)',
    routes: [
      { method: 'POST', path: '/auth/register', desc: 'Register a new user account', body: '{"email":"user@example.com","username":"myuser","display_name":"My Name","password":"SecurePass1"}' },
      { method: 'POST', path: '/auth/login', desc: 'Authenticate and receive JWT tokens', body: '{"email":"user@example.com","password":"SecurePass1"}' },
      { method: 'POST', path: '/auth/refresh', desc: 'Refresh access token', body: '{"refresh_token":"..."}' },
      { method: 'GET',  path: '/auth/me', desc: 'Get current user profile', auth: true },
    ]
  },
  {
    group: 'Voice Cloning',
    icon: Zap,
    color: '#7c3aed',
    routes: [
      { method: 'GET',  path: '/voices', desc: 'List voice profiles', auth: true },
      { method: 'POST', path: '/voices', desc: 'Create voice profile', auth: true, body: '{"name":"My Voice","language":"en","visibility":"private"}' },
      { method: 'POST', path: '/cloning/upload-sample/{voice_profile_id}', desc: 'Upload audio sample', auth: true, note: 'multipart/form-data with file field' },
      { method: 'POST', path: '/cloning/start', desc: 'Start clone job', auth: true, body: '{"voice_profile_id":"...","mode":"zero_shot"}' },
      { method: 'GET',  path: '/cloning/{job_id}', desc: 'Poll clone job status', auth: true },
    ]
  },
  {
    group: 'Voice Generation',
    icon: Wand2,
    color: '#7c3aed',
    routes: [
      { method: 'POST', path: '/generation', desc: 'Generate speech from text', auth: true, body: '{"text":"Hello world","language":"en","emotion":"neutral","speed":1.0,"output_format":"wav"}' },
      { method: 'GET',  path: '/generation/{job_id}', desc: 'Get generation result with audio URL', auth: true },
      { method: 'GET',  path: '/generation', desc: 'List generation history', auth: true },
    ]
  },
  {
    group: 'Deepfake Detection',
    icon: Shield,
    color: 'var(--red)',
    routes: [
      { method: 'POST', path: '/detection/analyze', desc: 'Upload audio for detection analysis', auth: true, note: 'multipart/form-data with file field' },
      { method: 'GET',  path: '/detection/{job_id}', desc: 'Get detection result with confidence timeline', auth: true },
      { method: 'GET',  path: '/detection/{job_id}/evidence', desc: 'Get chain-of-custody evidence report', auth: true },
      { method: 'GET',  path: '/detection/{job_id}/export/json', desc: 'Download full detection report as JSON', auth: true },
    ]
  },
  {
    group: 'Public Hub',
    icon: Globe,
    color: 'var(--amber)',
    routes: [
      { method: 'GET', path: '/hub/voices', desc: 'Browse public voice library', note: 'query: page, page_size, search, language, sort' },
      { method: 'GET', path: '/hub/featured', desc: 'Get featured voices' },
      { method: 'GET', path: '/hub/stats', desc: 'Get hub statistics' },
    ]
  },
  {
    group: 'WebSocket Streaming',
    icon: Activity,
    color: 'var(--green)',
    routes: [
      { method: 'WS', path: '/ws/detect/stream', desc: 'Real-time deepfake detection stream', note: 'Query: token=<jwt>&confidence_threshold=0.65. Send binary PCM audio chunks, receive JSON scores.' },
      { method: 'WS', path: '/ws/generate/stream', desc: 'Real-time TTS streaming', note: 'Query: token=<jwt>. Send JSON start message, receive binary audio chunks.' },
      { method: 'WS', path: '/ws/notifications', desc: 'Real-time notification push', note: 'Query: token=<jwt>. Server pushes notification events.' },
    ]
  },
]

const METHOD_STYLE: Record<string, { bg: string; color: string }> = {
  GET:  { bg: 'rgba(22,163,74,0.08)',  color: '#16a34a' },
  POST: { bg: 'rgba(37,99,235,0.08)',  color: 'var(--blue)' },
  PUT:  { bg: 'rgba(217,119,6,0.08)',  color: 'var(--amber)' },
  PATCH:{ bg: 'rgba(217,119,6,0.08)', color: 'var(--amber)' },
  DELETE:{ bg: 'rgba(220,38,38,0.08)',color: 'var(--red)' },
  WS:   { bg: 'rgba(124,58,237,0.08)',color: '#7c3aed' },
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ position: 'relative', marginTop: 10 }}>
      <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: '14px 16px', fontSize: 12.5, fontFamily: 'monospace', overflow: 'auto', margin: 0, lineHeight: 1.65 }}>{code}</pre>
      <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        style={{ position: 'absolute', top: 10, right: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
        {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
      </button>
    </div>
  )
}

function EndpointRow({ route }: { route: any }) {
  const [open, setOpen] = useState(false)
  const { accessToken } = useAuthStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const ms = METHOD_STYLE[route.method] || METHOD_STYLE.GET

  const runTest = async () => {
    if (!route.auth && !accessToken) return
    setTesting(true); setTestResult(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (route.auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const url = `${BASE}${route.path.replace(/{[^}]+}/g, 'test-id')}`
      const opts: RequestInit = { method: route.method === 'WS' ? 'GET' : route.method, headers }
      if (route.body && route.method !== 'GET') opts.body = route.body
      const res = await fetch(url, opts)
      const text = await res.text()
      try { setTestResult(JSON.stringify(JSON.parse(text), null, 2)) }
      catch { setTestResult(text.slice(0, 500) + (text.length > 500 ? '...' : '')) }
    } catch (e: any) { setTestResult(`Error: ${e.message}`) }
    finally { setTesting(false) }
  }

  const curlCmd = `curl -X ${route.method === 'WS' ? 'GET' : route.method} \\
  "${BASE}${route.path}" \\${route.auth ? `\n  -H "Authorization: Bearer $TOKEN" \\` : ''}${route.body ? `\n  -H "Content-Type: application/json" \\\n  -d '${route.body}'` : ''}`

  return (
    <div style={{ border: '1px solid var(--border-2)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: 'none', background: open ? 'var(--bg-2)' : 'var(--bg)', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: ms.bg, color: ms.color, fontFamily: 'monospace', flexShrink: 0 }}>{route.method}</span>
        <code style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1, fontFamily: 'monospace' }}>{route.path}</code>
        <span style={{ fontSize: 13, color: 'var(--fg-4)', flex: 2, textAlign: 'left' }}>{route.desc}</span>
        {open ? <ChevronDown size={14} style={{ color: 'var(--fg-5)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--fg-5)', flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border-2)', background: 'var(--bg-2)' }}>
          {route.note && <div style={{ fontSize: 13, color: 'var(--fg-4)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, borderLeft: '3px solid var(--blue)' }}>ℹ {route.note}</div>}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>cURL Example</div>
          <CodeBlock code={curlCmd} />
          {route.body && <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 14, marginBottom: 8 }}>Request Body</div>
            <CodeBlock code={JSON.stringify(JSON.parse(route.body), null, 2)} />
          </>}
          {route.method !== 'WS' && (
            <div style={{ marginTop: 14 }}>
              <button onClick={runTest} disabled={testing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)' }}>
                {testing ? 'Testing…' : '▶ Run Live Test'}
                {route.auth && <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>requires auth</span>}
              </button>
              {testResult && <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 12, marginBottom: 8 }}>Response</div>
                <CodeBlock code={testResult} />
              </>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApiDocsPage() {
  const { accessToken } = useAuthStore()
  const [copied, setCopied] = useState(false)

  const copyToken = () => {
    if (accessToken) { navigator.clipboard.writeText(accessToken); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Token copied') }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <Reveal>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code size={22} style={{ color: 'var(--fg-3)' }} /> API Documentation
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--fg-4)', marginTop: 4 }}>
            Base URL: <code style={{ fontFamily: 'monospace', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 5, fontSize: 12.5, color: 'var(--fg-2)' }}>{BASE}</code>
          </p>
        </div>
      </Reveal>

      {/* Auth info */}
      <Reveal delay={0.04}>
        <div className="card" style={{ padding: 20, marginBottom: 24, borderLeft: '3px solid var(--blue)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 8 }}>Authentication</div>
          <p style={{ fontSize: 13, color: 'var(--fg-4)', marginBottom: 12, lineHeight: 1.6 }}>
            All authenticated endpoints require a Bearer token in the Authorization header. Use <code style={{ fontFamily: 'monospace', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>POST /auth/login</code> to get your token, or use an API key from Settings → API Keys.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-3)' }}>
              {accessToken ? `Bearer ${accessToken.slice(0, 40)}...` : 'Log in to see your token'}
            </code>
            {accessToken && (
              <button onClick={copyToken} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)', flexShrink: 0 }}>
                {copied ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy Token</>}
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {/* Endpoints */}
      <StaggerGroup>
        {ENDPOINTS.map((group, gi) => (
          <StaggerItem key={group.group}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${group.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <group.icon size={14} style={{ color: group.color }} />
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{group.group}</h2>
              </div>
              {group.routes.map((route, ri) => (
                <EndpointRow key={ri} route={route} />
              ))}
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>

      {/* SDK example */}
      <Reveal delay={0.1}>
        <div className="card" style={{ padding: 24, marginTop: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginBottom: 14 }}>JavaScript SDK Example</div>
          <CodeBlock code={`// Install: npm install axios

import axios from 'axios'

const vc = axios.create({
  baseURL: '${BASE}',
  headers: { Authorization: \`Bearer \${YOUR_TOKEN}\` }
})

// 1. Generate speech
const job = await vc.post('/generation', {
  text: 'Hello from Voice-Crafter!',
  language: 'en',
  emotion: 'professional',
  output_format: 'mp3'
})

// 2. Poll until complete
let result
do {
  await new Promise(r => setTimeout(r, 1500))
  result = await vc.get(\`/generation/\${job.data.job_id}\`)
} while (result.data.status === 'processing')

console.log('Audio URL:', result.data.output_url)

// 3. Detect deepfake
const form = new FormData()
form.append('file', audioFile)
const detection = await vc.post('/detection/analyze', form)
// Poll for result the same way...`} />
        </div>
      </Reveal>
    </div>
  )
}
