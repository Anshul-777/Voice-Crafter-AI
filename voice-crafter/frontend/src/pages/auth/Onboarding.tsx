import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mic2, Wand2, Shield, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const STEPS = [
  { icon: Mic2, title: "Clone any voice", desc: "Upload 3 seconds of audio and clone any speaker instantly.", color: "bg-brand-50 text-brand-600" },
  { icon: Wand2, title: "Generate speech", desc: "Create expressive, natural speech in 17 languages.", color: "bg-violet-50 text-violet-600" },
  { icon: Shield, title: "Detect deepfakes", desc: "Protect yourself from AI-generated voice fraud.", color: "bg-red-50 text-red-600" },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  if (step >= STEPS.length) {
    navigate('/dashboard')
    return null
  }

  const s = STEPS[step]
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-6">
      <motion.div key={step} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} className="max-w-md w-full card p-10 text-center">
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => <div key={i} className={`h-1 rounded-full flex-1 max-w-16 ${i <= step ? 'bg-brand-500' : 'bg-surface-200'}`} />)}
        </div>
        <div className={`w-16 h-16 rounded-2xl ${s.color} flex items-center justify-center mx-auto mb-6`}>
          <s.icon size={28} />
        </div>
        <h2 className="text-2xl font-800 text-surface-900 mb-3">{s.title}</h2>
        <p className="text-surface-500 mb-8">{s.desc}</p>
        <button onClick={() => setStep(s => s + 1)} className="btn-primary w-full py-3 text-base">
          {step < STEPS.length - 1 ? 'Next' : 'Go to Dashboard'} <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  )
}
