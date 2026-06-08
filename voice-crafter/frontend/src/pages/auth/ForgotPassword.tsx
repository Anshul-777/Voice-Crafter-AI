import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft } from 'lucide-react'
import { authApi, getErrorMessage } from '@/api/client'
import { Spinner } from '@/components/ui/index'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="card p-8 shadow-lg">
        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-success-500/10 flex items-center justify-center mx-auto mb-4"><Mail size={24} className="text-success-500" /></div>
            <h2 className="text-xl font-800 text-surface-900 mb-2">Check your email</h2>
            <p className="text-surface-500 text-sm mb-6">We sent a password reset link to <strong>{email}</strong></p>
            <Link to="/login" className="text-brand-600 font-600 text-sm">← Back to sign in</Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-800 text-surface-900 mb-1">Reset password</h2>
            <p className="text-surface-500 text-sm mb-6">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input pl-10" placeholder="you@example.com" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? <Spinner size={18} /> : 'Send reset link'}</button>
            </form>
            <Link to="/login" className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mt-4 justify-center"><ArrowLeft size={14} />Back to sign in</Link>
          </>
        )}
      </div>
    </motion.div>
  )
}
