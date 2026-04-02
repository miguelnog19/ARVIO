import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  User, LogOut, Shield, Mail, ExternalLink, Puzzle, Settings2,
  Plus, Trash2, Check, Copy, Loader, RefreshCw, AlertCircle,
  CreditCard, Link2, Unlink
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  loadAddons, addAddon, removeAddon, toggleAddon, fetchAddonManifest,
  type AddonConfig,
} from '../api/streams'
import {
  isRdConnected, getRdApiKey, setRdApiKey, clearRdApiKey, getRdUser, loadRdApiKeyFromSupabase,
  type RdUser,
} from '../api/realDebrid'
import {
  isTraktConnected as _isTraktConnected, requestTraktDeviceCode, pollTraktDeviceToken,
  completeTraktAuth, getTraktUser, clearTraktTokens, loadTraktTokensFromSupabase,
  type TraktUser, type TraktDeviceCode,
} from '../api/trakt'

type Tab = 'general' | 'addons' | 'trakt' | 'realdebrid' | 'account'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) ?? 'general'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try { await signOut(); navigate('/login') }
    finally { setSigningOut(false) }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'addons', label: 'Addons', icon: <Puzzle className="w-4 h-4" /> },
    { id: 'trakt', label: 'Trakt', icon: <Link2 className="w-4 h-4" /> },
    { id: 'realdebrid', label: 'Real-Debrid', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 mb-8 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-accent text-white'
                : 'text-muted hover:text-white hover:bg-surface-2'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'addons' && <AddonsTab />}
      {activeTab === 'trakt' && <TraktTab />}
      {activeTab === 'realdebrid' && <RealDebridTab />}
      {activeTab === 'account' && (
        <AccountTab user={user} signingOut={signingOut} onSignOut={handleSignOut} />
      )}
    </div>
  )
}

// ── General Settings ──────────────────────────────────────────────────────

const GENERAL_SETTINGS_KEY = 'arvio_settings_v1'

interface GeneralSettings {
  autoPlayNext: boolean
  defaultSubtitleLanguage: string
  videoQuality: string
  showAdultContent: boolean
}

const defaultSettings: GeneralSettings = {
  autoPlayNext: true,
  defaultSubtitleLanguage: 'en',
  videoQuality: 'best',
  showAdultContent: false,
}

function GeneralTab() {
  const [settings, setSettings] = useState<GeneralSettings>(() => {
    try {
      const raw = localStorage.getItem(GENERAL_SETTINGS_KEY)
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
    } catch { return defaultSettings }
  })
  const [saved, setSaved] = useState(false)

  const update = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  const save = () => {
    localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-5">Playback</h2>
        <div className="space-y-4">
          <ToggleSetting
            label="Auto-play next episode"
            description="Automatically start the next episode when one ends"
            value={settings.autoPlayNext}
            onChange={(v) => update('autoPlayNext', v)}
          />
          <ToggleSetting
            label="Show adult content"
            description="Include adult titles in search and recommendations"
            value={settings.showAdultContent}
            onChange={(v) => update('showAdultContent', v)}
          />
          <SelectSetting
            label="Default video quality"
            description="Preferred quality when multiple sources are available"
            value={settings.videoQuality}
            options={[
              { value: 'best', label: 'Best available' },
              { value: '4K', label: '4K (2160p)' },
              { value: '1080p', label: '1080p Full HD' },
              { value: '720p', label: '720p HD' },
              { value: '480p', label: '480p SD' },
            ]}
            onChange={(v) => update('videoQuality', v)}
          />
          <SelectSetting
            label="Default subtitle language"
            description="Preferred subtitle language"
            value={settings.defaultSubtitleLanguage}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
              { value: 'de', label: 'German' },
              { value: 'pt', label: 'Portuguese' },
              { value: 'it', label: 'Italian' },
              { value: 'ja', label: 'Japanese' },
              { value: 'ko', label: 'Korean' },
              { value: 'zh', label: 'Chinese' },
            ]}
            onChange={(v) => update('defaultSubtitleLanguage', v)}
          />
        </div>
        <button
          onClick={save}
          className={`mt-6 flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            saved ? 'bg-green-600 text-white' : 'bg-accent hover:bg-accent-hover text-white'
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

// ── Addons Tab ─────────────────────────────────────────────────────────────

function AddonsTab() {
  const [addons, setAddons] = useState<AddonConfig[]>(() => loadAddons())
  const [inputUrl, setInputUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const refresh = () => setAddons(loadAddons())

  const handleAdd = async () => {
    if (!inputUrl.trim()) return
    setFetching(true)
    setFetchError(null)
    try {
      const addon = await fetchAddonManifest(inputUrl.trim())
      addAddon(addon)
      refresh()
      setInputUrl('')
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch addon')
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-2">Streaming Addons</h2>
        <p className="text-sm text-muted mb-5">
          Add any Stremio-compatible addon to enable stream sources for movies and TV shows. Paste the addon manifest URL below.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="https://addon.example.com/manifest.json"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAdd}
            disabled={fetching || !inputUrl.trim()}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {fetching ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
        {fetchError && (
          <p className="text-xs text-red-400 flex items-center gap-1 mb-3">
            <AlertCircle className="w-3 h-3" /> {fetchError}
          </p>
        )}

        {addons.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <Puzzle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No addons installed.</p>
            <p className="text-xs mt-1">Add a Stremio addon above to enable streaming.</p>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {addons.map((addon) => (
              <div key={addon.id} className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl p-3">
                {addon.logo ? (
                  <img src={addon.logo} alt={addon.name} className="w-8 h-8 rounded-lg object-contain bg-black flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Puzzle className="w-4 h-4 text-accent" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{addon.name}</p>
                  {addon.version && <p className="text-xs text-muted">v{addon.version}</p>}
                  {addon.description && (
                    <p className="text-xs text-muted/70 line-clamp-1 mt-0.5">{addon.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { toggleAddon(addon.id, !addon.enabled); refresh() }}
                    className={`w-10 h-5 rounded-full transition-colors relative ${addon.enabled ? 'bg-accent' : 'bg-surface-3'}`}
                    aria-label={addon.enabled ? 'Disable' : 'Enable'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${addon.enabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                  <button
                    onClick={() => { removeAddon(addon.id); refresh() }}
                    className="text-muted hover:text-red-400 transition-colors p-1"
                    aria-label="Remove addon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-2/50 border border-border/50 rounded-xl p-4 text-xs text-muted">
        <p className="font-medium text-white/70 mb-1">Popular community addons</p>
        <p>Look for Stremio addons at <a href="https://stremio-addons.netlify.app" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">stremio-addons.netlify.app</a> or the Stremio addon community.</p>
      </div>
    </div>
  )
}

// ── Trakt Tab ──────────────────────────────────────────────────────────────

function TraktTab() {
  const [connected, setConnected] = useState(false)
  const [traktUser, setTraktUser] = useState<TraktUser | null>(null)
  const [deviceCode, setDeviceCode] = useState<TraktDeviceCode | null>(null)
  const [polling, setPolling] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadTraktTokensFromSupabase().then((tokens) => {
      setConnected(!!tokens)
      if (tokens) {
        getTraktUser().then(setTraktUser).catch(() => {})
      }
    })
  }, [])

  const startAuth = async () => {
    setConnecting(true)
    setError(null)
    try {
      const code = await requestTraktDeviceCode()
      setDeviceCode(code)
      setPolling(true)
      const interval = code.interval * 1000
      const deadline = Date.now() + code.expires_in * 1000
      const poll = async () => {
        if (Date.now() > deadline) { setPolling(false); setError('Code expired. Try again.'); return }
        const resp = await pollTraktDeviceToken(code.device_code)
        if (resp.error === 'authorization_pending' || resp.error === 'slow_down') {
          setTimeout(poll, interval)
          return
        }
        if (resp.access_token) {
          await completeTraktAuth(resp)
          setConnected(true)
          setPolling(false)
          setDeviceCode(null)
          getTraktUser().then(setTraktUser).catch(() => {})
        } else {
          setError(resp.error ?? 'Unknown error')
          setPolling(false)
        }
      }
      setTimeout(poll, interval)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start auth')
      setConnecting(false)
    }
  }

  const disconnect = () => {
    clearTraktTokens()
    setConnected(false)
    setTraktUser(null)
    setDeviceCode(null)
  }

  const copyCode = () => {
    if (deviceCode?.user_code) {
      navigator.clipboard.writeText(deviceCode.user_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#ed2224]/10 border border-[#ed2224]/20 flex items-center justify-center">
            <span className="text-[#ed2224] font-bold text-lg">T</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Trakt.tv</h2>
            <p className="text-xs text-muted">Sync watch history across all your devices</p>
          </div>
          {connected && (
            <span className="ml-auto text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-full">Connected</span>
          )}
        </div>

        {!connected && !deviceCode && (
          <>
            <p className="text-sm text-muted mb-5">
              Connect your Trakt account to automatically scrobble what you watch and sync your history across the Android TV app and this web app.
            </p>
            {error && <p className="text-xs text-red-400 mb-3 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
            <button
              onClick={startAuth}
              disabled={connecting}
              className="flex items-center gap-2 bg-[#ed2224] hover:bg-[#c41d1f] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {connecting ? <Loader className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect Trakt
            </button>
          </>
        )}

        {deviceCode && (
          <div className="bg-surface-2 rounded-xl border border-border p-5 text-center">
            <p className="text-sm text-muted mb-3">Go to <strong className="text-white">{deviceCode.verification_url}</strong> and enter:</p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-accent">{deviceCode.user_code}</span>
              <button onClick={copyCode} className="text-muted hover:text-white transition-colors">
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            {polling && (
              <p className="text-xs text-muted flex items-center justify-center gap-2">
                <Loader className="w-3 h-3 animate-spin" />
                Waiting for authorization…
              </p>
            )}
            <button onClick={() => { setDeviceCode(null); setPolling(false) }} className="mt-3 text-xs text-muted hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        )}

        {connected && traktUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {traktUser.images?.avatar?.full && (
                <img src={traktUser.images.avatar.full} alt={traktUser.username} className="w-14 h-14 rounded-full" />
              )}
              <div>
                <p className="font-semibold">{traktUser.name ?? traktUser.username}</p>
                <p className="text-sm text-muted">@{traktUser.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://trakt.tv/users/${traktUser.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                View Trakt Profile <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              onClick={disconnect}
              className="flex items-center gap-2 text-sm text-muted hover:text-red-400 transition-colors"
            >
              <Unlink className="w-4 h-4" /> Disconnect Trakt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Real-Debrid Tab ────────────────────────────────────────────────────────

function RealDebridTab() {
  const [apiKey, setApiKeyState] = useState(() => getRdApiKey() ?? '')
  const [connected, setConnected] = useState(isRdConnected())
  const [rdUser, setRdUser] = useState<RdUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Try loading key from Supabase on mount (in case sessionStorage was cleared)
    loadRdApiKeyFromSupabase().then((key) => {
      if (key) {
        setApiKeyState(key)
        setConnected(true)
        setLoading(true)
        getRdUser().then(setRdUser).catch(() => {}).finally(() => setLoading(false))
      }
    })
  }, [])

  const connect = async () => {
    if (!apiKey.trim()) return
    setLoading(true)
    setError(null)
    try {
      await setRdApiKey(apiKey.trim())
      const user = await getRdUser()
      setRdUser(user)
      setConnected(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      await clearRdApiKey()
      setConnected(false)
      setError(e instanceof Error ? e.message : 'Invalid API key')
    } finally {
      setLoading(false)
    }
  }

  const disconnect = async () => {
    await clearRdApiKey()
    setConnected(false)
    setRdUser(null)
    setApiKeyState('')
  }

  const isPremium = rdUser && rdUser.premium > 0
  const expirationDate = rdUser?.expiration ? new Date(rdUser.expiration).toLocaleDateString() : null

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <span className="text-green-400 font-bold text-sm">RD</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Real-Debrid</h2>
            <p className="text-xs text-muted">Instantly stream cached torrents as direct HTTP links</p>
          </div>
          {connected && (
            <span className="ml-auto text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-full">Connected</span>
          )}
        </div>

        {!connected ? (
          <>
            <p className="text-sm text-muted mb-5">
              Real-Debrid resolves torrent streams from your addons into direct, high-speed download links — no P2P required in the browser.
              Get your API key from <a href="https://real-debrid.com/apitoken" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">real-debrid.com/apitoken</a>.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
                placeholder="Paste your Real-Debrid API key…"
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
              />
              <button
                onClick={connect}
                disabled={loading || !apiKey.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                  saved ? 'bg-green-600 text-white' : 'bg-accent hover:bg-accent-hover text-white'
                }`}
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {saved ? 'Connected!' : 'Connect'}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted text-sm">
                <Loader className="w-4 h-4 animate-spin" /> Loading account info…
              </div>
            ) : rdUser ? (
              <div className="bg-surface-2 rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg">
                    {rdUser.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{rdUser.username}</p>
                    <p className="text-sm text-muted">{rdUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-surface rounded-lg p-3">
                    <p className="text-xs text-muted">Account type</p>
                    <p className={`font-semibold mt-0.5 ${isPremium ? 'text-green-400' : 'text-muted'}`}>
                      {isPremium ? '✓ Premium' : 'Free'}
                    </p>
                  </div>
                  <div className="bg-surface rounded-lg p-3">
                    <p className="text-xs text-muted">Points</p>
                    <p className="font-semibold mt-0.5">{rdUser.points.toLocaleString()}</p>
                  </div>
                  {expirationDate && (
                    <div className="bg-surface rounded-lg p-3 col-span-2">
                      <p className="text-xs text-muted">Premium expires</p>
                      <p className="font-semibold mt-0.5">{expirationDate}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setLoading(true); getRdUser().then(setRdUser).catch(() => {}).finally(() => setLoading(false)) }}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                  <a
                    href="https://real-debrid.com/premium"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-accent hover:underline ml-auto"
                  >
                    Manage subscription <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : null}
            <button
              onClick={disconnect}
              className="flex items-center gap-2 text-sm text-muted hover:text-red-400 transition-colors"
            >
              <Unlink className="w-4 h-4" /> Disconnect Real-Debrid
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Account Tab ────────────────────────────────────────────────────────────

interface AccountTabProps {
  user: { email?: string; id?: string; created_at?: string; email_confirmed_at?: string | null } | null
  signingOut: boolean
  onSignOut: () => void
}

function AccountTab({ user, signingOut, onSignOut }: AccountTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
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
            <p className="text-xs text-muted mt-0.5">
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-accent" />
          Account Details
        </h2>
        <div className="space-y-3">
          <Row label="Email" value={user?.email ?? '—'} />
          <Row label="User ID" value={user?.id ? `${user.id.slice(0, 8)}…` : '—'} mono />
          <Row
            label="Email verified"
            value={user?.email_confirmed_at ? '✓ Verified' : 'Pending'}
            className={user?.email_confirmed_at ? 'text-green-400' : 'text-yellow-400'}
          />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Security
        </h2>
        <p className="text-sm text-muted">
          Your account is secured with Supabase Auth. Password changes are managed through your email provider.
        </p>
      </div>

      <button
        onClick={onSignOut}
        disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 bg-red-900/30 border border-red-700/50 text-red-300 hover:bg-red-900/50 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        <LogOut className="w-4 h-4" />
        {signingOut ? 'Signing out…' : 'Sign Out'}
      </button>
    </div>
  )
}

// ── Reusable setting components ────────────────────────────────────────────

function ToggleSetting({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-accent' : 'bg-surface-3'}`}
        aria-checked={value}
        role="switch"
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  )
}

function SelectSetting({ label, description, value, options, onChange }: {
  label: string; description: string; value: string;
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Row({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''} ${className ?? ''}`}>{value}</span>
    </div>
  )
}
