import { useCallback } from 'react'
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import type { WFNodeData } from '@shared/types/electron.d'

const OUTPUT_COLOR = '#38bdf8'

function mimeFromPath(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

export default function ImageNode({ id, data, selected }: { id: string; data: WFNodeData; selected?: boolean }) {
  const { updateNodeData, deleteElements } = useReactFlow()

  const filePath = data.params.filePath as string | undefined
  const preview  = data.params.preview  as string | undefined
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null

  const browse = useCallback(async () => {
    const p = await window.electron.fs.selectImage()
    if (!p) return
    const base64 = await window.electron.fs.readFileBase64(p)
    const src = `data:${mimeFromPath(p)};base64,${base64}`
    updateNodeData(id, { params: { ...data.params, filePath: p, preview: src } })
  }, [id, data.params, updateNodeData])

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      className={`rounded-xl border bg-zinc-900/95 backdrop-blur-sm shadow-xl flex flex-col ${selected ? 'border-accent/70' : 'border-zinc-700'}`}
    >
      <NodeResizer minWidth={160} minHeight={60} lineStyle={{ borderColor: 'transparent' }} handleStyle={{ background: 'transparent', border: 'none', width: 12, height: 12 }} />
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" className="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span className="text-[11px] font-semibold text-zinc-300 flex-1">Image</span>
        <button
          onClick={handleDelete}
          className="nodrag p-0.5 rounded text-zinc-700 hover:text-red-400 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Preview or picker */}
      <div className="flex-1 border-t border-zinc-800 min-h-0">
        {preview ? (
          <button onClick={browse} className="nodrag relative w-full h-full block group overflow-hidden rounded-b-xl">
            <img
              src={preview}
              alt={fileName ?? ''}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <span className="text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Change…
              </span>
            </div>
          </button>
        ) : (
          <div className="px-3 py-3">
            <button
              onClick={browse}
              className="nodrag w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-zinc-700 hover:border-sky-500/50 hover:bg-sky-500/5 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500 shrink-0">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              <span className="text-[10px] text-zinc-500">Browse…</span>
            </button>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: OUTPUT_COLOR, width: 14, height: 14, border: '2.5px solid #18181b' }}
      />
    </div>
  )
}
