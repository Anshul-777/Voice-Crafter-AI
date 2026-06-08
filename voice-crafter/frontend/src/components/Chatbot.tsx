import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Mic2, Minimize2, Maximize2, RefreshCw, Settings, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

// ── Supported free AI providers ──
type Provider = 'gemini' | 'groq' | 'openrouter'

interface ChatConfig {
  provider: Provider
  apiKey: string
  model: string
}

const PROVIDER_DEFAULTS: Record<Provider, { model: string; label: string; models: string[]; endpoint: string }> = {
  gemini: {
    label: 'Google Gemini (Free)',
    model: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent',
  },
  groq: {
    label: 'Groq (Free tier)',
    model: 'llama-3.1-8b-instant',
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
  openrouter: {
    label: 'OpenRouter (Free models)',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    models: ['meta-llama/llama-3.1-8b-instruct:free', 'mistralai/mistral-7b-instruct:free', 'google/gemma-2-9b-it:free'],
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
}

const SYSTEM_PROMPT = `You are VoiceBot, the AI assistant for Voice-Crafter — an enterprise voice AI platform. You help users with:

- Voice cloning using XTTS-v2 (zero-shot & fine-tune modes)
- Text-to-speech generation in 17 languages with emotion controls
- Deepfake detection using 5-model ensemble (AASIST, RawNet2, Prosodic, Spectral, Glottal)
- Live streaming analysis via WebSocket
- Public Voice Hub exploration
- API integration and authentication
- Plan/billing questions
- Quality analysis for audio samples

Be concise, helpful, and technical when needed. Reference specific features of the platform. Format responses clearly with markdown when helpful.`

interface Message { id: string; role: 'user' | 'assistant'; content: string; ts: number }

// ── API Callers ──
async function callGemini(messages: Message[], config: ChatConfig, onChunk: (t: string) => void) {
  const url = `${PROVIDER_DEFAULTS.gemini.endpoint.replace('{model}', config.model)}?key=${config.apiKey}&alt=sse`
  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nUser: ' + messages[0]?.content }] },
    ...messages.slice(1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ]
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const json = JSON.parse(line.slice(6))
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onChunk(text)
      } catch {}
    }
  }
}

async function callGroqOrOpenRouter(messages: Message[], config: ChatConfig, onChunk: (t: string) => void) {
  const endpoint = PROVIDER_DEFAULTS[config.provider].endpoint
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      ...(config.provider === 'openrouter' ? {
        'HTTP-Referer': 'https://voicecrafter.ai',
        'X-Title': 'Voice-Crafter',
      } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`${config.provider} error ${res.status}: ${await res.text()}`)
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
      try {
        const json = JSON.parse(line.slice(6))
        const text = json.choices?.[0]?.delta?.content
        if (text) onChunk(text)
      } catch {}
    }
  }
}

// ── Persist config in localStorage ──
const STORAGE_KEY = 'vc_chatbot_config'
function loadConfig(): ChatConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { provider: 'groq', apiKey: '', model: 'llama-3.1-8b-instant' }
}
function saveConfig(cfg: ChatConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

// ── Message bubble ──
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}
    >
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
          <Mic2 size={13} color="white" />
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: isUser ? '9px 13px' : '10px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'var(--blue)' : 'var(--bg-2)',
        color: isUser ? 'white' : 'var(--fg)',
        fontSize: 13.5,
        lineHeight: 1.6,
        border: isUser ? 'none' : '1px solid var(--border)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
    </motion.div>
  )
}

// ── Config Panel ──
function ConfigPanel({ config, onSave, onClose }: { config: ChatConfig; onSave: (c: ChatConfig) => void; onClose: () => void }) {
  const [form, setForm] = useState(config)
  const set = (k: keyof ChatConfig) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleProviderChange = (p: Provider) => {
    setForm(f => ({ ...f, provider: p, model: PROVIDER_DEFAULTS[p].model }))
  }

  return (
    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginBottom: 12 }}>AI Provider Settings</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-4)', display: 'block', marginBottom: 4 }}>PROVIDER</label>
          <select value={form.provider} onChange={e => handleProviderChange(e.target.value as Provider)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--fg)', outline: 'none' }}>
            {(Object.keys(PROVIDER_DEFAULTS) as Provider[]).map(p => (
              <option key={p} value={p}>{PROVIDER_DEFAULTS[p].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-4)', display: 'block', marginBottom: 4 }}>API KEY</label>
          <input type="password" value={form.apiKey} onChange={set('apiKey')} placeholder={`Enter your ${PROVIDER_DEFAULTS[form.provider].label} API key`} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--fg)', outline: 'none' }} />
          <div style={{ fontSize: 11, color: 'var(--fg-5)', marginTop: 3 }}>
            {form.provider === 'groq' && 'Get free key: console.groq.com'}
            {form.provider === 'gemini' && 'Get free key: aistudio.google.com/apikey'}
            {form.provider === 'openrouter' && 'Get free key: openrouter.ai/keys'}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-4)', display: 'block', marginBottom: 4 }}>MODEL</label>
          <select value={form.model} onChange={set('model')} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--fg)', outline: 'none' }}>
            {PROVIDER_DEFAULTS[form.provider].models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onSave(form); onClose() }} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--blue)', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg-3)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Chatbot Component ──
export default function Chatbot() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<ChatConfig>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Hi${user ? ` ${user.display_name?.split(' ')[0]}` : ''}! 👋 I'm VoiceBot, your Voice-Crafter assistant.\n\nI can help you with:\n• Voice cloning & generation\n• Deepfake detection\n• API integration\n• Platform features & billing\n\nWhat would you like to know?`,
        ts: Date.now(),
      }])
    }
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    if (!config.apiKey) { setShowConfig(true); setError('Please add an API key to use the chatbot.'); return }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, ts: Date.now() }
    const allMessages = [...messages, userMsg]
    setMessages(allMessages)
    setInput('')
    setLoading(true)
    setError(null)

    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', ts: Date.now() }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const userMessages = allMessages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-12) // last 12 msgs for context

      const onChunk = (chunk: string) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m
        ))
      }

      if (config.provider === 'gemini') {
        await callGemini(userMessages, config, onChunk)
      } else {
        await callGroqOrOpenRouter(userMessages, config, onChunk)
      }
    } catch (e: any) {
      const errMsg = e.message?.includes('401') ? 'Invalid API key. Check your settings.' :
                     e.message?.includes('429') ? 'Rate limit reached. Try again in a moment.' :
                     e.message?.includes('Failed to fetch') ? 'Network error. Check your connection.' :
                     `Error: ${e.message?.slice(0, 100)}`
      setError(errMsg)
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, config])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
    setTimeout(() => setOpen(p => { if (p) { setMessages([{ id: '0', role: 'assistant', content: 'Chat cleared! How can I help you?', ts: Date.now() }]); } return p }), 100)
  }

  const chatWidth = expanded ? 480 : 360
  const chatHeight = expanded ? 620 : 500

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--blue), #7c3aed)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
              color: 'white',
            }}
          >
            <MessageSquare size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
              width: chatWidth, height: chatHeight,
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 20, boxShadow: '0 20px 60px rgba(15,23,42,0.15)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mic2 size={15} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', lineHeight: 1 }}>VoiceBot</div>
                <div style={{ fontSize: 11, color: config.apiKey ? 'var(--green)' : 'var(--fg-5)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: config.apiKey ? 'var(--green)' : 'var(--fg-5)', display: 'inline-block' }} />
                  {config.apiKey ? `${PROVIDER_DEFAULTS[config.provider].label}` : 'API key not set'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={clearChat} title="Clear chat" style={{ padding: 6, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', display: 'flex' }}><RefreshCw size={13} /></button>
                <button onClick={() => setShowConfig(!showConfig)} title="Settings" style={{ padding: 6, borderRadius: 7, border: 'none', background: showConfig ? 'var(--bg-3)' : 'transparent', cursor: 'pointer', color: showConfig ? 'var(--blue)' : 'var(--fg-5)', display: 'flex' }}><Settings size={13} /></button>
                <button onClick={() => setExpanded(!expanded)} title="Resize" style={{ padding: 6, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', display: 'flex' }}>{expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
                <button onClick={() => setOpen(false)} title="Close" style={{ padding: 6, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', display: 'flex' }}><X size={14} /></button>
              </div>
            </div>

            {/* Config panel */}
            <AnimatePresence>
              {showConfig && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', flexShrink: 0 }}>
                  <ConfigPanel config={config} onSave={(c) => { setConfig(c); saveConfig(c); setError(null) }} onClose={() => setShowConfig(false)} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column' }}>
              {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mic2 size={13} color="white" />
                  </div>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-4)' }}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <div style={{ padding: '9px 13px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, fontSize: 12.5, color: 'var(--red)', marginBottom: 8 }}>
                  {error} {error.includes('API key') && <button onClick={() => setShowConfig(true)} style={{ color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, padding: 0, fontWeight: 600 }}>Open Settings</button>}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about cloning, detection, API…"
                  rows={1}
                  disabled={loading}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg-2)', fontSize: 13.5, color: 'var(--fg)', outline: 'none',
                    resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                    maxHeight: 100, overflow: 'auto',
                    transition: 'border-color 0.14s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !loading ? 'var(--blue)' : 'var(--bg-3)', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.14s', flexShrink: 0 }}>
                  <Send size={14} color={input.trim() && !loading ? 'white' : 'var(--fg-5)'} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-5)', marginTop: 6, textAlign: 'center' }}>
                Enter to send · Shift+Enter for newline
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
