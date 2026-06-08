import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, getErrorMessage } from '@/api/client'
import { Spinner } from '@/components/ui/index'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success('Password reset! Please sign in.')
      navigate('/login')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <div className="card p-8 shadow-lg">
      <h2 className="text-2xl font-800 text-surface-900 mb-1">Set new password</h2>
      <p className="text-surface-500 text-sm mb-6">Choose a strong password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="New password (min 8 chars)" required minLength={8} />
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? <Spinner size={18} /> : 'Reset password'}</button>
      </form>
    </div>
  )
}
