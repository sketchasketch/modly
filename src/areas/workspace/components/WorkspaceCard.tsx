import { type GenerationJob } from '@shared/stores/appStore'
import { formatTime, formatDate, formatPoly, MODEL_LABEL } from '../utils'

interface Props {
  job:      GenerationJob
  isActive: boolean
  onClick:  () => void
  onDelete: () => void
  disabled?: boolean
}

export function WorkspaceCard({ job, isActive, onClick, onDelete, disabled }: Props): JSX.Element {
  const modelLabel = job.modelId ? (MODEL_LABEL[job.modelId] ?? job.modelId) : null

  return (
    <div
      title={disabled ? 'A generation is in progress' : undefined}
      className={`
        group flex flex-col rounded-xl overflow-hidden border transition-all duration-150
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        ${isActive
          ? 'border-accent ring-1 ring-accent/40'
          : 'border-zinc-800 hover:border-zinc-600'
        }
      `}
      onClick={disabled ? undefined : onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-zinc-900 overflow-hidden">
        {job.thumbnailUrl ? (
          <img src={job.thumbnailUrl} alt="Generated model" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-zinc-700">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-zinc-950/80 border border-zinc-700/50 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-950/60 opacity-0 group-hover:opacity-100 transition-all duration-150"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>

        {/* Active dot */}
        {isActive && (
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-accent shadow-sm shadow-accent/50" />
        )}

        {/* Model badge */}
        {modelLabel && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-zinc-950/80 border border-zinc-700/40 text-[10px] font-medium text-zinc-400 leading-none">
            {modelLabel}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-300 truncate">{formatDate(job.createdAt)}</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">{formatTime(job.createdAt)}</p>
        </div>
        {job.originalTriangles != null && (
          <div className="flex items-center gap-1 shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600">
              <path d="M2 20L12 4l10 16H2z" />
            </svg>
            <span className="text-[11px] text-zinc-500 tabular-nums leading-none">
              {formatPoly(job.originalTriangles)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
