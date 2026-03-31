import { useCallback } from 'react'
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import type { WFNodeData } from '@shared/types/electron.d'

const OUTPUT_COLOR = '#fbbf24'

export default function TextNode({ id, data, selected }: { id: string; data: WFNodeData; selected?: boolean }) {
  const { updateNodeData, deleteElements } = useReactFlow()

  const text = (data.params.text as string | undefined) ?? ''

  const onChange = useCallback((v: string) => {
    updateNodeData(id, { params: { ...data.params, text: v } })
  }, [id, data.params, updateNodeData])

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      className={`rounded-xl border bg-zinc-900/95 backdrop-blur-sm shadow-xl flex flex-col ${selected ? 'border-accent/70' : 'border-zinc-700'}`}
    >
      <NodeResizer minWidth={180} minHeight={100} lineStyle={{ borderColor: 'transparent' }} handleStyle={{ background: 'transparent', border: 'none', width: 12, height: 12 }} />
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" className="shrink-0">
          <path d="M17 6.1H3M21 12.1H3M15.1 18H3"/>
        </svg>
        <span className="text-[11px] font-semibold text-zinc-300 flex-1">Text</span>
        <button
          onClick={handleDelete}
          className="nodrag p-0.5 rounded text-zinc-700 hover:text-red-400 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Textarea */}
      <div className="flex-1 px-3 pb-3 border-t border-zinc-800 pt-2.5 flex">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter text…"
          className="nodrag w-full flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed"
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: OUTPUT_COLOR, width: 14, height: 14, border: '2.5px solid #18181b' }}
      />
    </div>
  )
}
