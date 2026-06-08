import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Mic2, Sparkles, Shield, Wand2 } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.25),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.18),_transparent_26%),linear-gradient(180deg,_#020617,_#0f172a_48%,_#020617)]" />
      <header className="relative px-6 py-5">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-accent-700 shadow-lg shadow-brand-500/25 transition-transform duration-200 group-hover:scale-105">
              <Mic2 size={18} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight">Voice-Crafter</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Enterprise Voice AI</div>
            </div>
          </Link>
          <Link to="/" className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white/20 hover:bg-white/10 sm:inline-flex">
            <Sparkles size={14} /> View landing
          </Link>
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 pb-10 pt-4 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:pb-16">
        <section className="hidden overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:block">
          <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">
            <Shield size={14} className="text-cyan-300" /> Secure by design
          </div>
          <h1 className="max-w-xl text-5xl font-extrabold leading-none tracking-tight lg:text-7xl">
            Build with voice AI that feels polished from the first screen.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-white/65">
            The landing page is now focused on the only two entry points the app needs first. Sign in or create an account, then move into a tighter, cleaner dashboard.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ['Voice cloning', 'Fast onboarding for audio profiles'],
              ['Generation', 'Expressive output with streaming'],
              ['Detection', 'Multi-model fraud analysis'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/25 to-cyan-300/15">
                  <Wand2 size={18} className="text-white" />
                </div>
                <div className="font-bold">{title}</div>
                <div className="mt-1 text-sm leading-6 text-white/55">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-center py-2 lg:py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>

      <footer className="relative px-6 py-5 text-center text-xs text-white/35">
        © 2026 Voice-Crafter. All rights reserved.
      </footer>
    </div>
  )
}
