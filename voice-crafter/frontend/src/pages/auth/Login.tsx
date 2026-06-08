import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Mic2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/index'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/api/client'

export default function Login() {
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="rounded-[28px] border border-white/10 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-200">
            <Sparkles size={12} /> Welcome back
          </div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">Sign in</h1>
          <p className="text-sm text-white/60">Continue into your voice workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35 focus:border-brand-400/70 focus:ring-brand-400/20"
                placeholder="you@example.com" required />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="mb-0 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="input border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/35 focus:border-brand-400/70 focus:ring-brand-400/20"
                placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary mt-2 h-12 w-full text-base">
            {loading ? <Spinner size={18} /> : <><span>Sign in</span><ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-white/55">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-cyan-200 hover:text-cyan-100">Create one free</Link>
        </div>
      </div>
    </motion.div>
  )
}
