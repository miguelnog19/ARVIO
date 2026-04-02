import { useEffect, useRef } from 'react'
import { X, Play, Loader, WifiOff, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { StreamSource } from '../api/streams'

interface AddonGroup {
  addonId: string
  addonName: string
  streams: StreamSource[]
  loading: boolean
  error?: string
}

interface StreamSelectorProps {
  title: string
  addonGroups: AddonGroup[]
  onSelect: (stream: StreamSource) => void
  onClose: () => void
}

const QUALITY_ORDER = ['4K', '1080p', '720p', '480p', 'SD', 'CAM']

function qualityColor(q: string): string {
  switch (q) {
    case '4K': return 'text-purple-400 border-purple-500/40 bg-purple-500/10'
    case '1080p': return 'text-blue-400 border-blue-500/40 bg-blue-500/10'
    case '720p': return 'text-green-400 border-green-500/40 bg-green-500/10'
    case '480p': return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
    default: return 'text-muted border-border bg-surface-2'
  }
}

function sortStreams(streams: StreamSource[]): StreamSource[] {
  return [...streams].sort((a, b) => {
    const qa = QUALITY_ORDER.indexOf(a.quality)
    const qb = QUALITY_ORDER.indexOf(b.quality)
    if (qa !== qb) return (qa === -1 ? 99 : qa) - (qb === -1 ? 99 : qb)
    // RD cached first
    if (a.isRdCached && !b.isRdCached) return -1
    if (!a.isRdCached && b.isRdCached) return 1
    return 0
  })
}

export default function StreamSelector({ title, addonGroups, onSelect, onClose }: StreamSelectorProps) {
  const allStreams = addonGroups.flatMap((g) => g.streams)
  const allLoading = addonGroups.some((g) => g.loading)
  const hasError = addonGroups.length === 1 && addonGroups[0].error && allStreams.length === 0
  const hasNoAddons = hasError && addonGroups[0].error?.includes('No addons')

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const sorted = sortStreams(allStreams)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-white">Select Source</h2>
            <p className="text-xs text-muted mt-0.5 truncate max-w-xs">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-surface-2 hover:bg-surface-3 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[70vh]">
          {allLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader className="w-8 h-8 text-accent animate-spin" />
              <p className="text-sm text-muted">Searching sources…</p>
              {addonGroups.map((g) => (
                g.loading && (
                  <p key={g.addonId} className="text-xs text-muted/60">{g.addonName}…</p>
                )
              ))}
            </div>
          )}

          {hasNoAddons && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 px-6 text-center">
              <WifiOff className="w-10 h-10 text-muted opacity-40" />
              <p className="text-sm text-muted">No streaming addons configured.</p>
              <Link
                to="/settings?tab=addons"
                onClick={onClose}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Add Addons
              </Link>
            </div>
          )}

          {!hasNoAddons && !allLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
              <WifiOff className="w-10 h-10 text-muted opacity-40" />
              <p className="text-sm text-muted">No sources found.</p>
              <p className="text-xs text-muted/60">Try adding more addons in Settings.</p>
            </div>
          )}

          {sorted.length > 0 && (
            <ul className="divide-y divide-border/50">
              {/* If still loading, show spinner row */}
              {allLoading && (
                <li className="flex items-center gap-2 px-5 py-3 text-xs text-muted">
                  <Loader className="w-3 h-3 animate-spin" />
                  Loading more sources…
                </li>
              )}
              {sorted.map((stream, idx) => {
                const label = stream.title ?? stream.name ?? `Stream ${idx + 1}`
                const isRd = stream.isRdCached
                const isTorrent = !!stream.infoHash && !stream.url
                return (
                  <li key={idx}>
                    <button
                      onClick={() => onSelect(stream)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className="flex-shrink-0">
                        <Play className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium line-clamp-2 leading-snug">{label}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted">{stream.addonName}</span>
                          {stream.size && (
                            <span className="text-xs text-muted/60">{stream.size}</span>
                          )}
                          {isTorrent && !isRd && (
                            <span className="text-xs text-orange-400/80 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                              P2P
                            </span>
                          )}
                          {isRd && (
                            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                              RD ⚡
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-bold border px-2 py-0.5 rounded ${qualityColor(stream.quality)}`}>
                        {stream.quality}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
