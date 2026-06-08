import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, X, Send, Mic2, Minimize2, Maximize2,
  Bot, User, RefreshCw, Copy, Check, Zap, Sparkles
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { WaveBars } from '@/components/ui/shared'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  loading?: boolean
}

const SYSTEM_PROMPT = `You are the Voice-Crafter AI assistant — a helpful, knowledgeable guide for the Voice-Crafter platform. 

Voice-Crafter is an enterprise voice AI platform with three main pillars:
1. Voice Cloning — clone any voice using XTTS-v2, zero-shot and fine-tune modes
2. Voice Generation — expressive TTS in 17 languages with emotion, speed, pitch controls
3. Deepfake Detection — 5-model ensemble (AASIST, RawNet2, Prosodic, Spectral, Glottal)

You help users with:
- How to clone voices and upload samples
- Generating speech from text
- Understanding detection results and confidence scores
- API usage and integration guidance
- Plan comparison and features
- Technical questions about models and audio quality
- Navigation and feature discovery

Be concise, friendly, and technically accurate. Format responses with bullet points when listing steps.
If asked something outside your knowledge, say so honestly.`

const QUICK_PROMPTS = [
  'How do I clone a voice?',
  'What does ensemble confidence mean?',
  'How do I use the API?',
  'What plan should I choose?',
  'How to improve detection accuracy?',
  'What audio format works best?',
]

// Calls the Anthropic API — replace VITE_CHATBOT_API_KEY with your key
async function callChatbot(messages: Message[], userMessage: string): Promise<string> {
  const apiKey = import.meta.env.VITE_CHATBOT_API_KEY
  if (!apiKey) {
    // Fallback for no API key — still functional demo responses
    return getFallbackResponse(userMessage)
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        ...messages.filter(m => m.role !== 'system' && !m.loading).map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || 'Sorry, I could not generate a response.'
}

function getFallbackResponse(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('clone') || msg.includes('cloning'))
    return 'To clone a voice:\n1. Go to **Clone Voice** in the sidebar\n2. Create or select a voice profile\n3. Upload a clear audio sample (3s minimum, 30s+ recommended)\n4. Wait for the quality analysis\n5. Click **Start Voice Clone**\n\nFor best results, use a quiet recording with SNR above 25dB.'
  if (msg.includes('detect') || msg.includes('deepfake') || msg.includes('confidence'))
    return 'The ensemble confidence score combines 5 models:\n- **AASIST** — graph attention on raw waveform\n- **RawNet2** — sinc-conv end-to-end\n- **Prosodic** — pitch & energy patterns\n- **Spectral** — mel-spectrogram artifacts\n- **Glottal** — cepstral analysis\n\nA score ≥ 65% flags the audio as suspicious. The confidence timeline shows how risk changes across audio segments.'
  if (msg.includes('api'))
    return 'To access the API:\n1. Go to **Settings → API Keys**\n2. Create a new API key (requires Starter plan+)\n3. Include it as `X-API-Key` header or Bearer token\n4. Base URL: `https://api.voicecrafter.ai/v1`\n\nSee the **API Docs** page for full endpoint reference.'
  if (msg.includes('plan') || msg.includes('upgrade') || msg.includes('price'))
    return 'Plan comparison:\n- **Free** — 2 voices, 5 clones/mo, 10K chars, 30min detection\n- **Starter ($19/mo)** — 10 voices, 50 clones, 100K chars, API access, streaming\n- **Pro ($79/mo)** — 50 voices, 500 clones, 1M chars, fine-tuning, SSML\n- **Enterprise ($299/mo)** — Unlimited everything + custom models\n\nGo to **Billing & Plans** to upgrade.'
  if (msg.includes('quality') || msg.includes('snr') || msg.includes('audio'))
    return 'For optimal voice cloning quality:\n- **SNR**: 25dB+ (use Quality Lab to check)\n- **Duration**: 30–120 seconds of speech\n- **Environment**: quiet room, no echo\n- **Format**: WAV or FLAC at 16kHz+\n- **Content**: natural speech, varied sentences\n\nAvoid recordings with music, background noise, or heavy compression.'
  if (msg.includes('generate') || msg.includes('tts') || msg.includes('speech'))
    return 'To generate speech:\n1. Go to **Generate TTS**\n2. Enter your text (up to 5,000 chars)\n3. Select a voice profile or use the system default\n4. Choose language, emotion, and style\n5. Adjust speed and temperature if needed\n6. Click **Generate Speech**\n\nSupports 17 languages and emotions like happy, calm, professional, storytelling, and more.'
  return 'I\'m here to help with Voice-Crafter! You can ask me about:\n- Voice cloning and sample requirements\n- TTS generation and language support\n- Deepfake detection and interpreting results\n- API integration and authentication\n- Plan comparison and feature availability\n- Audio quality optimization\n\nWhat would you like to know?'
}

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Render markdown-lite: bold, bullets
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      const rendered = parts.map((part, j) => j % 2 === 1
        ? <strong key={j} style={{ fontWeight: 700, color: isUser ? 'rgba(255,255,255,0.95)' : 'var(--fg)' }}>{part}</strong>
        : part
      )
      if (line.startsWith('- ')) {
        return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
          <span style={{ color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--blue)', marginTop: 1, flexShrink: 0 }}>•</span>
          <span>{rendered.map((r, j) => j === 0 ? (r as string).slice(2) : r)}</span>
        </div>
      }
      if (/^\d+\./.test(line)) {
        const [num, ...rest] = line.split(/^(\d+\.\s)/)
        return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
          <span style={{ color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--blue)', flexShrink: 0, minWidth: 18, textAlign: 'right' }}>{line.match(/^\d+/)?.[0]}.</span>
          <span>{rendered}</span>
        </div>
      }
      return <div key={i} style={{ marginBottom: i < lines.length - 1 && line === '' ? 6 : line ? 2 : 0 }}>{rendered}</div>
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}
    >
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
          <Bot size={13} color="white" />
        </div>
      )}
      <div style={{ maxWidth: '80%', position: 'relative' }}>
        <div style={{
          padding: '10px 14px', borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
          background: isUser ? 'linear-gradient(135deg, var(--blue), #1d4ed8)' : 'var(--bg)',
          color: isUser ? 'white' : 'var(--fg-2)',
          boxShadow: isUser ? '0 4px 14px rgba(37,99,235,0.25)' : 'var(--sh)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: 13.5, lineHeight: 1.6,
        }}>
          {msg.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WaveBars color="var(--blue)" bars={5} height={18} active />
              <span style={{ fontSize: 13, color: 'var(--fg-4)' }}>Thinking…</span>
            </div>
          ) : renderContent(msg.content)}
        </div>
        {!msg.loading && !isUser && (
          <button onClick={copy} style={{ position: 'absolute', top: 6, right: -28, padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-5)', borderRadius: 5, opacity: 0, transition: 'opacity 0.15s', display: 'flex' }}
            className="copy-btn">
            {copied ? <Check size={11} style={{ color: 'var(--green)' }} /> : <Copy size={11} />}
          </button>
        )}
        <div style={{ fontSize: 10.5, color: isUser ? 'rgba(255,255,255,0.5)' : 'var(--fg-5)', marginTop: 4, textAlign: isUser ? 'right' : 'left', paddingLeft: 4 }}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
          <User size={13} style={{ color: 'var(--fg-4)' }} />
        </div>
      )}
    </motion.div>
  )
}

export default function ChatbotWidget() {
  const { user } = useAuthStore()
  const [open, setOpen]           = useState(false)
  const [expanded, setExpanded]   = useState(false)
  const [messages, setMessages]   = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: `Hi${user?.display_name ? ` ${user.display_name.split(' ')[0]}` : ''}! 👋 I'm the Voice-Crafter assistant. I can help you with voice cloning, TTS generation, deepfake detection, API usage, and more. What would you like to know?`,
    timestamp: new Date(),
  }])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() }
    const loadingMsg: Message = { id: 'loading', role: 'assistant', content: '', timestamp: new Date(), loading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const reply = await callChatbot(messages, content)
      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: Date.now().toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }))
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I ran into an error: ${e.message || 'Unknown error'}. Please try again or check your API key configuration.`,
        timestamp: new Date(),
      }))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const clearChat = () => {
    setMessages([{
      id: '0', role: 'assistant',
      content: 'Chat cleared. How can I help you?',
      timestamp: new Date(),
    }])
  }

  const width = expanded ? 560 : 380
  const height = expanded ? 640 : 520

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
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 999,
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--blue), #1d4ed8)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 28px rgba(37,99,235,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            whileHover={{ scale: 1.08, boxShadow: '0 12px 36px rgba(37,99,235,0.45)' }}
            whileTap={{ scale: 0.94 }}
            title="Ask the Voice-Crafter assistant"
          >
            <MessageCircle size={22} color="white" />
            <motion.div
              style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid white' }}
              animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
              width, height, maxWidth: 'calc(100vw - 32px)',
              background: 'var(--bg)', borderRadius: 20,
              border: '1px solid var(--border)',
              boxShadow: '0 24px 72px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.10)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 18px', background: 'linear-gradient(135deg, #1d3a8a, #1e1060)',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={18} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Voice-Crafter AI
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>Always ready to help</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={clearChat} style={{ padding: 6, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', borderRadius: 7, color: 'rgba(255,255,255,0.7)', display: 'flex', transition: 'background 0.12s' }} title="Clear chat">
                  <RefreshCw size={13} />
                </button>
                <button onClick={() => setExpanded(!expanded)} style={{ padding: 6, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', borderRadius: 7, color: 'rgba(255,255,255,0.7)', display: 'flex', transition: 'background 0.12s' }} title={expanded ? 'Minimize' : 'Expand'}>
                  {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button onClick={() => setOpen(false)} style={{ padding: 6, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', borderRadius: 7, color: 'rgba(255,255,255,0.7)', display: 'flex', transition: 'background 0.12s' }} title="Close">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-2)' }}>
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              <div ref={bottomRef} />
            </div>

            {/* Quick prompts */}
            {messages.length <= 2 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} onClick={() => sendMessage(p)} disabled={loading}
                      style={{ padding: '5px 10px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s', flexShrink: 0 }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--blue-soft)'; (e.target as HTMLElement).style.color = 'var(--blue)'; (e.target as HTMLElement).style.borderColor = 'var(--blue-ring)' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--bg)'; (e.target as HTMLElement).style.color = 'var(--fg-3)'; (e.target as HTMLElement).style.borderColor = 'var(--border)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask anything about Voice-Crafter…"
                disabled={loading}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--bg-2)', fontSize: 13.5, color: 'var(--fg)', outline: 'none',
                  transition: 'border-color 0.14s', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--blue)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <motion.button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                whileHover={!loading && input.trim() ? { scale: 1.05 } : {}}
                whileTap={!loading && input.trim() ? { scale: 0.95 } : {}}
                style={{
                  width: 38, height: 38, borderRadius: 11, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  background: input.trim() && !loading ? 'var(--blue)' : 'var(--bg-3)',
                  color: input.trim() && !loading ? 'white' : 'var(--fg-5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.15s', boxShadow: input.trim() && !loading ? 'var(--sh-blue)' : 'none',
                }}>
                {loading ? <WaveBars color="var(--fg-5)" bars={4} height={16} active /> : <Send size={15} />}
              </motion.button>
            </div>

            {/* Footer hint */}
            <div style={{ padding: '5px 14px 8px', background: 'var(--bg)', textAlign: 'center' }}>
              <span style={{ fontSize: 10.5, color: 'var(--fg-5)' }}>
                Powered by Claude · <span style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => window.open('https://console.anthropic.com', '_blank')}>Add API key</span> for full AI responses
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .copy-btn { opacity: 0; }
        div:hover > .copy-btn { opacity: 1; }
      `}</style>
    </>
  )
}
