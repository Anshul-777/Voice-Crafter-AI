import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Eye, EyeOff, Mic2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/index'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/api/client'

export default function Register() {
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', display_name: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await register(form)
      toast.success('Account created! Please check your email to verify.')
      navigate('/login')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="rounded-[28px] border border-white/10 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-violet-200">
            <Sparkles size={12} /> Create account
          </div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">Get started</h1>
          <p className="text-sm text-white/60">Build with voice AI in a cleaner workspace.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Full Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={form.display_name} onChange={set('display_name')} className="input border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35 focus:border-brand-400/70 focus:ring-brand-400/20" placeholder="Your full name" required />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-white/30">@</span>
              <input value={form.username} onChange={set('username')} className="input border-white/10 bg-white/5 pl-8 text-white placeholder:text-white/35 focus:border-brand-400/70 focus:ring-brand-400/20" placeholder="yourhandle" required />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="email" value={form.email} onChange={set('email')} className="input border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35 focus:border-brand-400/70 focus:ring-brand-400/20" placeholder="you@example.com" required />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} className="input border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/35 focus:border-brand-400/70 focus:ring-brand-400/20" placeholder="Min 8 chars, 1 upper, 1 number" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary mt-2 h-12 w-full text-base">
            {loading ? <Spinner size={18} /> : 'Create free account'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-white/40">By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
        <div className="mt-4 text-center text-sm text-white/55">
          Already have an account? <Link to="/login" className="font-bold text-cyan-200 hover:text-cyan-100">Sign in</Link>
        </div>
      </div>
    </motion.div>
  )
}
