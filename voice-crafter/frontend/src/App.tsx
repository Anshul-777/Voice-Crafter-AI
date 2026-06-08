import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import AppLayout from './components/layout/AppLayout'
import AuthLayout from './components/layout/AuthLayout'
import Chatbot from './components/Chatbot'

const Landing       = lazy(() => import('./pages/Landing'))
const Login         = lazy(() => import('./pages/auth/Login'))
const Register      = lazy(() => import('./pages/auth/Register'))
const ForgotPw      = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPw       = lazy(() => import('./pages/auth/ResetPassword'))
const VerifyEmail   = lazy(() => import('./pages/auth/VerifyEmail'))
const Onboarding    = lazy(() => import('./pages/auth/Onboarding'))
const Dashboard     = lazy(() => import('./pages/dashboard/Dashboard'))
const VoiceLibrary  = lazy(() => import('./pages/voices/VoiceLibrary'))
const VoiceDetail   = lazy(() => import('./pages/voices/VoiceDetail'))
const ClonePage     = lazy(() => import('./pages/voices/ClonePage'))
const GeneratePage  = lazy(() => import('./pages/voices/GeneratePage'))
const DetectionLab  = lazy(() => import('./pages/detection/DetectionLab'))
const LiveDetect    = lazy(() => import('./pages/detection/LiveDetection'))
const DetectResult  = lazy(() => import('./pages/detection/DetectionResult'))
const HubPage       = lazy(() => import('./pages/hub/HubPage'))
const HubVoice      = lazy(() => import('./pages/hub/HubVoiceDetail'))
const PublicProfile = lazy(() => import('./pages/hub/PublicProfile'))
const Analytics     = lazy(() => import('./pages/analytics/Analytics'))
const Billing       = lazy(() => import('./pages/billing/Billing'))
const HistoryPage   = lazy(() => import('./pages/history/HistoryPage'))
const Notifications = lazy(() => import('./pages/notifications/NotificationsPage'))
const AuditPage     = lazy(() => import('./pages/audit/AuditPage'))
const SettingsPage  = lazy(() => import('./pages/settings/SettingsPage'))
const ProfilePage   = lazy(() => import('./pages/settings/ProfilePage'))
const ApiDocsPage   = lazy(() => import('./pages/api_docs/ApiDocsPage'))
const BenchmarksPage= lazy(() => import('./pages/benchmarks/BenchmarksPage'))
const QualityPage   = lazy(() => import('./pages/quality/QualityPage'))
const AdminPage     = lazy(() => import('./pages/admin/AdminPage'))

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:10, color:'var(--fg-5)', fontSize:13 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ color:'var(--blue)' }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity={0.2}/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      Loading…
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()
  return accessToken ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()
  return accessToken ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export default function App() {
  const { accessToken, refreshUser } = useAuthStore()
  useEffect(() => { if (accessToken) refreshUser().catch(() => {}) }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-right" gutter={8} toastOptions={{ duration:4000, style:{ borderRadius:12, fontSize:13.5, fontWeight:500, padding:'10px 14px', border:'1px solid var(--border)', boxShadow:'0 8px 24px rgba(15,23,42,0.12)', background:'white', color:'var(--fg)' }, success:{ iconTheme:{ primary:'#16a34a', secondary:'#fff' } }, error:{ iconTheme:{ primary:'#dc2626', secondary:'#fff' } } }} />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route element={<AuthLayout />}>
            <Route path="/login"           element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register"        element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/forgot-password" element={<ForgotPw />} />
            <Route path="/reset-password"  element={<ResetPw />} />
            <Route path="/verify-email"    element={<VerifyEmail />} />
          </Route>
          <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/voices"         element={<VoiceLibrary />} />
            <Route path="/voices/:id"     element={<VoiceDetail />} />
            <Route path="/clone"          element={<ClonePage />} />
            <Route path="/generate"       element={<GeneratePage />} />
            <Route path="/detection"      element={<DetectionLab />} />
            <Route path="/detection/live" element={<LiveDetect />} />
            <Route path="/detection/:id"  element={<DetectResult />} />
            <Route path="/hub"            element={<HubPage />} />
            <Route path="/hub/:id"        element={<HubVoice />} />
            <Route path="/analytics"      element={<Analytics />} />
            <Route path="/billing"        element={<Billing />} />
            <Route path="/history"        element={<HistoryPage />} />
            <Route path="/notifications"  element={<Notifications />} />
            <Route path="/audit"          element={<AuditPage />} />
            <Route path="/settings"       element={<SettingsPage />} />
            <Route path="/profile"        element={<ProfilePage />} />
            <Route path="/api-docs"       element={<ApiDocsPage />} />
            <Route path="/benchmarks"     element={<BenchmarksPage />} />
            <Route path="/quality"        element={<QualityPage />} />
            <Route path="/admin"          element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {accessToken && <Chatbot />}
    </BrowserRouter>
  )
}
