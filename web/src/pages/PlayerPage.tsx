import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Maximize, Minimize, Volume2, VolumeX, Loader, AlertCircle } from 'lucide-react'
import Hls from 'hls.js'
import { resolveWithRd, isRdConnected } from '../api/realDebrid'
import { scrobbleTraktMovie, scrobbleTraktEpisode, isTraktConnected } from '../api/trakt'

export default function PlayerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const url = searchParams.get('url') ?? ''
  const infoHash = searchParams.get('infoHash') ?? ''
  const fileIdx = searchParams.get('fileIdx') ? Number(searchParams.get('fileIdx')) : undefined
  const title = searchParams.get('title') ?? 'Playing'
  const mediaType = (searchParams.get('type') ?? 'movie') as 'movie' | 'tv'
  const tmdbId = searchParams.get('tmdbId') ? Number(searchParams.get('tmdbId')) : undefined
  const season = searchParams.get('season') ? Number(searchParams.get('season')) : undefined
  const episode = searchParams.get('episode') ? Number(searchParams.get('episode')) : undefined

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrobbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(url || null)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  // ── Resolve torrent via RD if needed ──────────────────────────────────────
  useEffect(() => {
    if (url) {
      setResolvedUrl(url)
      return
    }
    if (!infoHash) {
      setError('No stream URL or torrent hash provided.')
      return
    }
    if (!isRdConnected()) {
      setError('This is a torrent stream. Connect Real-Debrid in Settings to play it.')
      return
    }
    setResolving(true)
    resolveWithRd(infoHash, fileIdx)
      .then((direct) => {
        if (!direct) {
          setError('Real-Debrid could not resolve this torrent. It may not be cached.')
        } else {
          setResolvedUrl(direct)
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setResolving(false))
  }, [url, infoHash, fileIdx])

  // ── HLS / video setup ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedUrl || !videoRef.current) return

    const video = videoRef.current

    // Clean previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const isHls = resolvedUrl.includes('.m3u8') || resolvedUrl.includes('/hls')

    if (isHls && Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(resolvedUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError(`Stream error: ${data.details}`)
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHls) {
      video.src = resolvedUrl
    } else {
      video.src = resolvedUrl
    }

    video.play().catch(() => {/* autoplay blocked – user must click play */})

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
      video.pause()
      video.src = ''
    }
  }, [resolvedUrl])

  // ── Scrobble to Trakt every 30 s ──────────────────────────────────────────
  const scrobble = useCallback(() => {
    if (!isTraktConnected() || !tmdbId || !videoRef.current) return
    const v = videoRef.current
    if (!v.duration || v.duration < 60) return
    const pct = v.currentTime / v.duration
    if (pct < 0.01) return
    if (mediaType === 'movie') {
      scrobbleTraktMovie(tmdbId, pct).catch(() => {})
    } else if (season && episode) {
      scrobbleTraktEpisode(tmdbId, season, episode, pct).catch(() => {})
    }
  }, [tmdbId, mediaType, season, episode])

  useEffect(() => {
    scrobbleTimerRef.current = setInterval(scrobble, 30000)
    return () => {
      clearInterval(scrobbleTimerRef.current!)
      scrobble() // final scrobble on unmount
    }
  }, [scrobble])

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3500)
  }, [])

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  if (resolving) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader className="w-10 h-10 text-accent animate-spin" />
        <p className="text-muted text-sm">Resolving stream via Real-Debrid…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-red-400 font-medium">{error}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-accent hover:underline">← Go back</button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black"
      style={{ minHeight: '100vh' }}
      onMouseMove={showControls}
      onClick={showControls}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-screen object-contain"
        muted={muted}
        controls={false}
        playsInline
      />

      {/* Custom controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-b from-black/70 to-transparent">
          <button
            onClick={() => navigate(-1)}
            className="text-white/80 hover:text-white flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <span className="text-white font-medium text-sm truncate">{title}</span>
        </div>

        {/* Bottom controls */}
        <div className="px-4 py-4 bg-gradient-to-t from-black/70 to-transparent">
          {/* Native progress / time */}
          {videoRef.current && (
            <input
              type="range"
              min={0}
              max={videoRef.current?.duration || 100}
              defaultValue={0}
              className="w-full mb-3 accent-accent"
              onChange={(e) => {
                if (videoRef.current) videoRef.current.currentTime = Number(e.target.value)
              }}
            />
          )}
          <div className="flex items-center gap-4">
            <button onClick={() => videoRef.current?.play()} className="text-white hover:text-accent transition-colors text-xs font-medium">
              ▶ Play
            </button>
            <button onClick={() => videoRef.current?.pause()} className="text-white hover:text-accent transition-colors text-xs font-medium">
              ⏸ Pause
            </button>
            <button onClick={() => setMuted((m) => !m)} className="text-white/70 hover:text-white transition-colors ml-auto">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
