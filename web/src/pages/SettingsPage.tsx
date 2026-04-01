import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Shield, Mail, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Profile Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-accent" />
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-2xl font-bold text-accent">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-medium">{user?.email}</p>
            <p className="text-xs text-muted mt-0.5">Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</p>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-accent" />
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">User ID</span>
            <span className="text-sm font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Email verified</span>
            <span className={`text-xs font-medium ${user?.email_confirmed_at ? 'text-green-400' : 'text-yellow-400'}`}>
              {user?.email_confirmed_at ? '✓ Verified' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Trakt Integration */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-accent" />
          Trakt Integration
        </h2>
        <p className="text-sm text-muted mb-4">
          Connect your Trakt account to sync your watched movies and shows across devices.
        </p>
        <a
          href="https://trakt.tv"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-medium transition-colors"
        >
          Visit Trakt.tv <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Security */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Security
        </h2>
        <p className="text-sm text-muted">
          Your account is secured with Supabase Auth. Password changes and advanced security settings are managed through your email.
        </p>
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 bg-red-900/30 border border-red-700/50 text-red-300 hover:bg-red-900/50 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        <LogOut className="w-4 h-4" />
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  )
}
