import { useCallback } from 'react'
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import { useAppStore } from '@shared/stores/appStore'
import { useNavStore } from '@shared/stores/navStore'
import type { WFNodeData } from '@shared/types/electron.d'

const INPUT_COLOR = '#a78bfa'

export default function AddToSceneNode({ id, data, selected }: { id: string; data: WFNodeData; selected?: boolean }) {
  const { deleteElements } = useReactFlow()
  const { navigate }       = useNavStore()
  const setCurrentJob      = useAppStore((s) => s.setCurrentJob)

  const outputUrl = data.params.outputUrl as string | undefined

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const viewIn3D = useCallback(() => {
    if (!outputUrl) return
    setCurrentJob({
      id:        'workflow-output',
      imageFile: '',
      status:    'done',
      progress:  100,
      outputUrl,
      createdAt: Date.now(),
    })
    navigate('generate')
  }, [outputUrl, setCurrentJob, navigate])

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      className={`rounded-xl border bg-zinc-900/95 backdrop-blur-sm shadow-xl ${selected ? 'border-accent/70' : 'border-zinc-700'}`}
    >
      <NodeResizer minWidth={160} minHeight={60} lineStyle={{ borderColor: 'transparent' }} handleStyle={{ background: 'transparent', border: 'none', width: 12, height: 12 }} />

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: INPUT_COLOR, width: 14, height: 14, border: '2.5px solid #18181b' }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" className="shrink-0">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <span className="text-[11px] font-semibold text-zinc-300 flex-1">Add to Scene</span>
        <button
          onClick={handleDelete}
          className="nodrag p-0.5 rounded text-zinc-700 hover:text-red-400 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* IO tag */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border border-violet-500/30 bg-violet-500/10 text-violet-400">mesh</span>
        <span className="text-[9px] text-zinc-600">→ scene</span>
      </div>

      {/* Body */}
      <div className="px-3 pb-3 border-t border-zinc-800 pt-2.5">
        {outputUrl ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] text-emerald-400">Mesh ready</span>
            </div>
            <button
              onClick={viewIn3D}
              className="nodrag w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 hover:border-violet-500/50 transition-colors text-[10px] font-medium"
            >
              Add to 3D scene
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 italic">Connect a mesh to add it to the 3D scene.</p>
        )}
      </div>
    </div>
  )
}
