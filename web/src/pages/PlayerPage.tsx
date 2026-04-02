import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Maximize, Minimize, Volume2, VolumeX, Loader, AlertCircle,
  SkipBack, SkipForward, Play, Pause, Subtitles, AudioLines, RefreshCw,
  StretchHorizontal, SkipForward as NextEpIcon,
} from 'lucide-react'
import Hls from 'hls.js'
import { resolveWithRd, isRdConnected } from '../api/realDebrid'
import { scrobbleTraktMovie, scrobbleTraktEpisode, isTraktConnected } from '../api/trakt'
import { saveProgress, formatDuration } from '../api/progress'
import {
  fetchMovieSubtitles, fetchEpisodeSubtitles,
  type SubtitleTrack,
} from '../api/streams'

// ── Aspect ratio cycle ─────────────────────────────────────────────────────
const ASPECT_MODES = ['contain', 'cover', 'fill'] as const
type AspectMode = typeof ASPECT_MODES[number]
const ASPECT_LABELS: Record<AspectMode, string> = {
  contain: 'Fit',
  cover: 'Crop',
  fill: 'Stretch',
}

// ── Quality / audio track helpers ──────────────────────────────────────────
interface HlsLevel { height: number; bitrate: number; name: string }
interface AudioTrack { id: number; name: string; lang: string }

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PlayerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const streamUrl = searchParams.get('url') ?? ''
  const infoHash = searchParams.get('infoHash') ?? ''
  const fileIdxParam = searchParams.get('fileIdx') ? Number(searchParams.get('fileIdx')) : undefined
  const title = searchParams.get('title') ?? 'Playing'
  const mediaType = (searchParams.get('type') ?? 'movie') as 'movie' | 'tv'
  const tmdbId = searchParams.get('tmdbId') ? Number(searchParams.get('tmdbId')) : undefined
  const season = searchParams.get('season') ? Number(searchParams.get('season')) : undefined
  const episode = searchParams.get('episode') ? Number(searchParams.get('episode')) : undefined
  const imdbId = searchParams.get('imdbId') ?? ''
  const quality = searchParams.get('quality') ?? ''
  const sourceSize = searchParams.get('sourceSize') ?? ''
  const posterPath = searchParams.get('posterPath') ?? ''
  const episodeTitle = searchParams.get('episodeTitle') ?? ''
  // Next-episode URL (pre-built by detail page)
  const nextEpUrl = searchParams.get('nextEp') ?? ''

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrobbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(streamUrl || null)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Playback state
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [aspectMode, setAspectMode] = useState<AspectMode>('contain')
  const [controlsVisible, setControlsVisible] = useState(true)

  // HLS tracks
  const [hlsLevels, setHlsLevels] = useState<HlsLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1) // -1 = auto
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [currentAudio, setCurrentAudio] = useState(0)

  // Subtitles
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleTrack | null>(null)
  const [subtitleText, setSubtitleText] = useState('')

  // Panel toggles
  const [showSubMenu, setShowSubMenu] = useState(false)
  const [showAudioMenu, setShowAudioMenu] = useState(false)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [showSourceMenu, setShowSourceMenu] = useState(false)

  // Clock
  const [clock, setClock] = useState(formatClock(new Date()))
  const [endsAt, setEndsAt] = useState('')

  useEffect(() => {
    const t = setInterval(() => setClock(formatClock(new Date())), 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (duration > 0) {
      const rem = duration - currentTime
      const end = new Date(Date.now() + rem * 1000)
      setEndsAt(formatClock(end))
    }
  }, [duration, currentTime])

  // ── Resolve torrent ────────────────────────────────────────────────────────
  useEffect(() => {
    if (streamUrl) { setResolvedUrl(streamUrl); return }
    if (!infoHash) { setError('No stream URL or torrent hash provided.'); return }
    if (!isRdConnected()) { setError('Connect Real-Debrid in Settings to play torrent streams.'); return }
    setResolving(true)
    resolveWithRd(infoHash, fileIdxParam)
      .then((direct) => {
        if (!direct) setError('Real-Debrid could not resolve this torrent. It may not be cached.')
        else setResolvedUrl(direct)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setResolving(false))
  }, [streamUrl, infoHash, fileIdxParam])

  // ── HLS setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedUrl || !videoRef.current) return
    const video = videoRef.current
    hlsRef.current?.destroy()
    hlsRef.current = null
    const isHls = resolvedUrl.includes('.m3u8') || resolvedUrl.includes('/hls')

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.loadSource(resolvedUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels: HlsLevel[] = data.levels.map((l, i) => ({
          height: l.height,
          bitrate: l.bitrate,
          name: l.height ? `${l.height}p` : `Level ${i + 1}`,
        }))
        setHlsLevels(levels)
        setCurrentLevel(-1)
      })
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(data.audioTracks.map((t, i) => ({ id: i, name: t.name, lang: t.lang ?? '' })))
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError(`Stream error: ${data.details}`)
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHls) {
      video.src = resolvedUrl
    } else {
      video.src = resolvedUrl
    }

    video.play().catch(() => {})

    return () => {
      hlsRef.current?.destroy(); hlsRef.current = null
      video.pause(); video.src = ''
    }
  }, [resolvedUrl])

  // ── Video event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      const bufLen = video.buffered.length
      if (bufLen > 0) setBuffered(video.buffered.end(bufLen - 1))
    }
    const onDuration = () => setDuration(video.duration)
    const onVolumeChange = () => { setMuted(video.muted); setVolume(video.volume) }
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDuration)
    video.addEventListener('volumechange', onVolumeChange)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDuration)
      video.removeEventListener('volumechange', onVolumeChange)
    }
  }, [resolvedUrl])

  // ── Load subtitles from OpenSubtitles ─────────────────────────────────────
  useEffect(() => {
    if (!imdbId) return
    const load = async () => {
      const tracks = mediaType === 'movie'
        ? await fetchMovieSubtitles(imdbId)
        : season && episode ? await fetchEpisodeSubtitles(imdbId, season, episode) : []
      setSubtitleTracks(tracks)
    }
    load()
  }, [imdbId, mediaType, season, episode])

  // ── Active subtitle cue rendering (VTT via fetch) ─────────────────────────
  useEffect(() => {
    if (!activeSubtitle) { setSubtitleText(''); return }
    const video = videoRef.current
    if (!video) return

    let cues: { start: number; end: number; text: string }[] = []

    const fetchVtt = async () => {
      try {
        const res = await fetch(activeSubtitle.url)
        const text = await res.text()
        cues = parseVtt(text)
      } catch { cues = [] }
    }

    fetchVtt()

    const onTime = () => {
      const t = video.currentTime
      const cue = cues.find((c) => t >= c.start && t <= c.end)
      setSubtitleText(cue?.text ?? '')
    }

    video.addEventListener('timeupdate', onTime)
    return () => video.removeEventListener('timeupdate', onTime)
  }, [activeSubtitle])

  // ── Save progress every 10 s ───────────────────────────────────────────────
  const persistProgress = useCallback(() => {
    const video = videoRef.current
    if (!video || !tmdbId || video.duration < 30) return
    saveProgress({
      mediaType,
      tmdbId,
      season,
      episode,
      positionSeconds: video.currentTime,
      durationSeconds: video.duration,
      title,
      episodeTitle: episodeTitle || undefined,
      posterPath: posterPath || undefined,
      source: resolvedUrl ?? undefined,
    }).catch(() => {})
  }, [tmdbId, mediaType, season, episode, title, episodeTitle, posterPath, resolvedUrl])

  useEffect(() => {
    progressTimerRef.current = setInterval(persistProgress, 10000)
    return () => {
      clearInterval(progressTimerRef.current!)
      persistProgress()
    }
  }, [persistProgress])

  // ── Scrobble to Trakt ──────────────────────────────────────────────────────
  const scrobble = useCallback(() => {
    if (!isTraktConnected() || !tmdbId || !videoRef.current) return
    const v = videoRef.current
    if (!v.duration || v.duration < 60) return
    const pct = v.currentTime / v.duration
    if (pct < 0.01) return
    if (mediaType === 'movie') scrobbleTraktMovie(tmdbId, pct).catch(() => {})
    else if (season && episode) scrobbleTraktEpisode(tmdbId, season, episode, pct).catch(() => {})
  }, [tmdbId, mediaType, season, episode])

  useEffect(() => {
    scrobbleTimerRef.current = setInterval(scrobble, 30000)
    return () => { clearInterval(scrobbleTimerRef.current!); scrobble() }
  }, [scrobble])

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
      setShowSubMenu(false); setShowAudioMenu(false); setShowQualityMenu(false); setShowSourceMenu(false)
    }, 4000)
  }, [])

  // ── Sync muted state imperatively (React `muted` prop is buggy for <video>) ──
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  // ── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const seek = useCallback((delta: number) => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta))
  }, [])

  const toggleMute = useCallback(() => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) { containerRef.current.requestFullscreen(); setFullscreen(true) }
    else { document.exitFullscreen(); setFullscreen(false) }
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      showControls()
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowLeft') seek(-10)
      if (e.key === 'ArrowRight') seek(10)
      if (e.key === 'f') toggleFullscreen()
      if (e.key === 'm') toggleMute()
      if (e.key === 'Escape') { setShowSubMenu(false); setShowAudioMenu(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showControls, togglePlay, seek, toggleFullscreen, toggleMute])

  const cycleAspect = () => {
    const idx = ASPECT_MODES.indexOf(aspectMode)
    setAspectMode(ASPECT_MODES[(idx + 1) % ASPECT_MODES.length])
  }

  const setVolumeLevel = (v: number) => {
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 }
  }

  const setQualityLevel = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level
      setCurrentLevel(level)
    }
    setShowQualityMenu(false)
  }

  const setAudioTrack = (id: number) => {
    if (hlsRef.current) hlsRef.current.audioTrack = id
    setCurrentAudio(id)
    setShowAudioMenu(false)
  }

  const selectSubtitle = (track: SubtitleTrack | null) => {
    setActiveSubtitle(track)
    setShowSubMenu(false)
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (resolving) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader className="w-10 h-10 text-accent animate-spin" />
        <p className="text-muted text-sm">Resolving stream via Real-Debrid…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-red-400 font-medium">{error}</p>
        <button onClick={() => navigate(-1)} className="mt-2 text-sm text-accent hover:underline">← Go back</button>
      </div>
    )
  }

  // Build display title parts
  const epLabel = (season && episode) ? `S${season}E${episode}` : ''
  const displayTitle = epLabel ? `${title} · ${epLabel}` : title
  const qualityLabel = quality || (currentLevel >= 0 && hlsLevels[currentLevel] ? hlsLevels[currentLevel].name : 'AUTO')

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden select-none"
      onMouseMove={showControls}
      onClick={() => { showControls(); setShowSubMenu(false); setShowAudioMenu(false); setShowQualityMenu(false); setShowSourceMenu(false) }}
    >
      {/* ── Video ── */}
      <video
        ref={videoRef}
        className={`w-full h-full ${
          aspectMode === 'contain' ? 'object-contain' :
          aspectMode === 'cover' ? 'object-cover' : 'object-fill'
        }`}
        playsInline
      />

      {/* ── Subtitle overlay ── */}
      {subtitleText && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-3xl px-6 text-center pointer-events-none z-30">
          <div
            className="text-white text-xl font-medium leading-snug"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)' }}
          >
            {subtitleText.split('\n').map((line, i) => (
              <span key={i}>{line}{i < subtitleText.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Controls overlay ── */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top bar ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-12 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            {posterPath && (
              <img
                src={`https://image.tmdb.org/t/p/w92${posterPath}`}
                alt={title}
                className="h-9 w-auto rounded shadow flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate leading-tight">{displayTitle}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {qualityLabel && (
                  <span className="text-xs bg-accent/80 text-white px-1.5 py-0.5 rounded font-bold leading-none">{qualityLabel}</span>
                )}
                {sourceSize && (
                  <span className="text-xs text-white/50">{sourceSize}</span>
                )}
                {episodeTitle && (
                  <span className="text-xs text-white/70 truncate max-w-xs">{episodeTitle}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: clock */}
          <div className="flex-shrink-0 text-right text-xs text-white/70 leading-relaxed ml-4">
            <p className="font-medium text-white/90 text-sm">{clock}</p>
            {endsAt && <p>Ends {endsAt}</p>}
          </div>
        </div>

        {/* ── Centre: big play/pause click area ── */}
        <div
          className="flex-1 flex items-center justify-center cursor-pointer"
          onDoubleClick={toggleFullscreen}
          onClick={togglePlay}
        >
          {!playing && (
            <div className="w-20 h-20 rounded-full bg-black/50 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            </div>
          )}
        </div>

        {/* ── Bottom controls ── */}
        <div
          className="px-5 pb-5 pt-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-white/80 font-mono w-12 text-right flex-shrink-0">
              {formatDuration(currentTime)}
            </span>
            <div className="relative flex-1 h-1.5 group/seek cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              if (videoRef.current) videoRef.current.currentTime = pct * duration
            }}>
              {/* Track */}
              <div className="absolute inset-y-0 left-0 right-0 bg-white/20 rounded-full" />
              {/* Buffered */}
              <div
                className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
              />
              {/* Played */}
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/seek:opacity-100 transition-opacity -ml-1.5"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-white/60 font-mono w-12 flex-shrink-0">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1">
            {/* Rewind 10s */}
            <ControlBtn onClick={() => seek(-10)} label="Rewind 10s">
              <SkipBack className="w-5 h-5" />
            </ControlBtn>

            {/* Play / Pause */}
            <ControlBtn onClick={togglePlay} label={playing ? 'Pause' : 'Play'} className="w-11 h-11 text-white">
              {playing ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
            </ControlBtn>

            {/* Skip 10s */}
            <ControlBtn onClick={() => seek(10)} label="Skip 10s">
              <SkipForward className="w-5 h-5" />
            </ControlBtn>

            {/* Volume */}
            <ControlBtn onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </ControlBtn>
            <input
              type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVolumeLevel(Number(e.target.value))}
              className="w-20 accent-accent cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="flex-1" />

            {/* Next episode */}
            {nextEpUrl && (
              <ControlBtn onClick={() => navigate(nextEpUrl)} label="Next Episode" className="text-accent">
                <NextEpIcon className="w-5 h-5" />
              </ControlBtn>
            )}

            {/* Source switcher */}
            <div className="relative">
              <ControlBtn
                onClick={(e) => { e.stopPropagation(); setShowSourceMenu((v) => !v); setShowSubMenu(false); setShowAudioMenu(false); setShowQualityMenu(false) }}
                label="Switch source"
              >
                <RefreshCw className="w-5 h-5" />
              </ControlBtn>
              {showSourceMenu && (
                <FloatingMenu title="Switch Source">
                  <button
                    onClick={() => { setShowSourceMenu(false); navigate(-1) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-2 text-white/90 transition-colors"
                  >
                    ← Go back to source picker
                  </button>
                </FloatingMenu>
              )}
            </div>

            {/* Audio tracks */}
            {audioTracks.length > 1 && (
              <div className="relative">
                <ControlBtn
                  onClick={(e) => { e.stopPropagation(); setShowAudioMenu((v) => !v); setShowSubMenu(false); setShowQualityMenu(false); setShowSourceMenu(false) }}
                  label="Audio tracks"
                >
                  <AudioLines className="w-5 h-5" />
                </ControlBtn>
                {showAudioMenu && (
                  <FloatingMenu title="Audio">
                    {audioTracks.map((t) => (
                      <TrackItem key={t.id} label={t.name || t.lang} active={t.id === currentAudio}
                        onClick={() => setAudioTrack(t.id)} />
                    ))}
                  </FloatingMenu>
                )}
              </div>
            )}

            {/* Subtitles */}
            <div className="relative">
              <ControlBtn
                onClick={(e) => { e.stopPropagation(); setShowSubMenu((v) => !v); setShowAudioMenu(false); setShowQualityMenu(false); setShowSourceMenu(false) }}
                label="Subtitles"
                className={activeSubtitle ? 'text-accent' : ''}
              >
                <Subtitles className="w-5 h-5" />
              </ControlBtn>
              {showSubMenu && (
                <FloatingMenu title="Subtitles">
                  <TrackItem label="Off" active={!activeSubtitle} onClick={() => selectSubtitle(null)} />
                  {subtitleTracks.map((t) => (
                    <TrackItem key={t.id} label={t.label} active={activeSubtitle?.id === t.id}
                      onClick={() => selectSubtitle(t)} />
                  ))}
                  {subtitleTracks.length === 0 && (
                    <p className="text-xs text-muted text-center py-2">No subtitles found</p>
                  )}
                </FloatingMenu>
              )}
            </div>

            {/* Quality */}
            {hlsLevels.length > 1 && (
              <div className="relative">
                <ControlBtn
                  onClick={(e) => { e.stopPropagation(); setShowQualityMenu((v) => !v); setShowSubMenu(false); setShowAudioMenu(false); setShowSourceMenu(false) }}
                  label="Quality"
                >
                  <span className="text-xs font-bold">{currentLevel >= 0 ? hlsLevels[currentLevel]?.name : 'AUTO'}</span>
                </ControlBtn>
                {showQualityMenu && (
                  <FloatingMenu title="Quality">
                    <TrackItem label="Auto" active={currentLevel === -1} onClick={() => setQualityLevel(-1)} />
                    {hlsLevels.map((l, i) => (
                      <TrackItem key={i} label={l.name} active={currentLevel === i} onClick={() => setQualityLevel(i)} />
                    ))}
                  </FloatingMenu>
                )}
              </div>
            )}

            {/* Aspect / scale */}
            <ControlBtn onClick={cycleAspect} label={`Scale: ${ASPECT_LABELS[aspectMode]}`}>
              <StretchHorizontal className="w-5 h-5" />
            </ControlBtn>

            {/* Fullscreen */}
            <ControlBtn onClick={toggleFullscreen} label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </ControlBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ControlBtnProps {
  onClick: (e: React.MouseEvent) => void
  label: string
  children: React.ReactNode
  className?: string
}
function ControlBtn({ onClick, label, children, className = '' }: ControlBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all ${className}`}
    >
      {children}
    </button>
  )
}

interface FloatingMenuProps {
  title: string
  children: React.ReactNode
}
function FloatingMenu({ title, children }: FloatingMenuProps) {
  return (
    <div
      className="absolute bottom-full right-0 mb-2 bg-surface/95 backdrop-blur-sm border border-border/60 rounded-xl shadow-2xl min-w-[180px] max-h-72 overflow-y-auto z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-muted font-semibold px-4 py-2 border-b border-border/40 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

interface TrackItemProps {
  label: string
  active: boolean
  onClick: () => void
}
function TrackItem({ label, active, onClick }: TrackItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
        active ? 'text-accent bg-accent/10' : 'text-white/90 hover:bg-surface-2'
      }`}
    >
      {active && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
      {!active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" />}
      {label}
    </button>
  )
}

// ── VTT parser (minimal) ───────────────────────────────────────────────────
function parseVtt(text: string): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = []
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startStr, endStr] = timeLine.split(/\s+-->\s+/)
    const start = parseVttTime(startStr)
    const end = parseVttTime(endStr)
    const textLines = lines.slice(lines.indexOf(timeLine) + 1)
    // VTT cue text is rendered as React plain-text nodes (never via dangerouslySetInnerHTML),
    // so there is no XSS risk. We strip VTT ruby/bold/italic formatting tags for display only.
    // lgtm[js/incomplete-multi-character-sanitization]
    const stripped = textLines.join('\n').replace(/<[^>]*>/g, '')
    const decoded = stripped
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    const cueText = decoded.trim()
    if (cueText) cues.push({ start, end, text: cueText })
  }
  return cues
}

function parseVttTime(s: string): number {
  const parts = s.trim().replace(',', '.').split(':')
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1])
  }
  return 0
}
