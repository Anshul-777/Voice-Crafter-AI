// LoadingScreen.tsx
import React from 'react'
import { Mic2 } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 z-50">
      <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-lg animate-bounce-subtle">
        <Mic2 size={24} className="text-white" />
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
