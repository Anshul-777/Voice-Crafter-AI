import { Link } from 'react-router-dom'
import { ArrowRight, Mic2, PlayCircle, Shield, Sparkles, Wand2 } from 'lucide-react'

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(155,114,255,0.16),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(0,229,255,0.09),_transparent_28%),linear-gradient(180deg,_#07070f_0%,_#090b16_42%,_#05060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.14)_0.5px,transparent_0.5px)] [background-size:18px_18px]" />

      <header className="relative border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/20 to-cyan-400/15 shadow-lg shadow-brand-500/15">
              <Mic2 size={19} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight">Voice-Crafter</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Enterprise Voice AI</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/login" className="btn btn-ghost hidden sm:inline-flex">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary">
              Create account <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#d8cbff]">
            <Sparkles size={13} /> New landing experience
          </div>

          <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-tight sm:text-6xl lg:text-7xl">
            Build with voice AI that feels polished from the first screen.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
            Create voices, clone them responsibly, run detection, and ship natural-sounding audio without fighting a cluttered interface.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="btn btn-ghost">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary">
              Start free <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/70">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Shield size={14} className="text-cyan-300" /> Secure by design
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Wand2 size={14} className="text-violet-300" /> Fast generation
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <PlayCircle size={14} className="text-emerald-300" /> Live previews
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Studio preview
            </div>

            <div className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(17,20,40,0.9),rgba(11,14,30,0.96))] p-5 sm:p-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-white">Voice generation</div>
                    <div className="mt-1 text-xs text-white/45">Natural, expressive, and controllable</div>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                    Ready
                  </span>
                </div>

                <div className="mt-5 h-16 rounded-2xl bg-[linear-gradient(90deg,rgba(155,114,255,0.14),rgba(0,229,255,0.12))]" />

                <div className="mt-5 grid gap-3">
                  {[
                    ['Clone quality', '94%'],
                    ['Detection confidence', '88%'],
                    ['Generation latency', '1.8s'],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                      <span className="text-white/60">{label}</span>
                      <span className="font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
