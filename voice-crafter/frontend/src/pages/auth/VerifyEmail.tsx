import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import { authApi } from '@/api/client'
import { Spinner } from '@/components/ui/index'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    authApi.verifyEmail(token).then(() => setStatus('success')).catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="card p-10 shadow-lg text-center">
      {status === 'loading' && <><Spinner size={32} className="mx-auto mb-4" /><p className="text-surface-500">Verifying your email…</p></>}
      {status === 'success' && <>
        <CheckCircle size={40} className="text-success-500 mx-auto mb-4" />
        <h2 className="text-xl font-800 text-surface-900 mb-2">Email verified!</h2>
        <p className="text-surface-500 mb-6">Your account is now active.</p>
        <Link to="/login" className="btn-primary">Sign in now</Link>
      </>}
      {status === 'error' && <>
        <XCircle size={40} className="text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-800 text-surface-900 mb-2">Verification failed</h2>
        <p className="text-surface-500 mb-6">The link may have expired.</p>
        <Link to="/login" className="btn-secondary">Back to login</Link>
      </>}
    </div>
  )
}
