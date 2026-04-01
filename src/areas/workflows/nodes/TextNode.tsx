import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { WFNodeData } from '@shared/types/electron.d'
import BaseNode from './BaseNode'

const OUTPUT_COLOR = '#fbbf24'

export default function TextNode({ id, data, selected }: { id: string; data: WFNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow()
  const text = (data.params.text as string | undefined) ?? ''

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Text"
      showInGenerate={data.showInGenerate ?? false}
      minWidth={180}
      minHeight={100}
      icon={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
          <path d="M17 6.1H3M21 12.1H3M15.1 18H3"/>
        </svg>
      }
      handles={
        <Handle type="source" position={Position.Right}
          style={{ background: OUTPUT_COLOR, width: 14, height: 14, border: '2.5px solid #18181b' }} />
      }
    >
      <div className="px-3 pb-3 pt-2.5 flex-1 flex">
        <textarea
          value={text}
          onChange={(e) => updateNodeData(id, { params: { ...data.params, text: e.target.value } })}
          placeholder="Enter text…"
          className="nodrag w-full flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed"
        />
      </div>
    </BaseNode>
  )
}
