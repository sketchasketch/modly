import { useState, useCallback, useRef, useLayoutEffect } from 'react'
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import { useExtensionsStore } from '@shared/stores/extensionsStore'
import { buildAllWorkflowExtensions } from '../mockExtensions'
import type { ParamSchema, WorkflowExtension } from '../mockExtensions'
import type { WFNodeData } from '@shared/types/electron.d'

// ─── Handle colors by IO type ─────────────────────────────────────────────────

const HANDLE_COLOR: Record<string, string> = {
  image: '#38bdf8',
  mesh:  '#a78bfa',
  text:  '#fbbf24',
}

// ─── Param control ────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-accent/60'

function ParamControl({ param, value, onChange }: {
  param:    ParamSchema
  value:    number | string
  onChange: (v: number | string) => void
}) {
  if (param.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {param.options?.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label ?? String(o.value)}</option>
        ))}
      </select>
    )
  }

  if (param.type === 'string') {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value as string}
          placeholder={param.tooltip ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <button
          onClick={async () => {
            const p = await window.electron.fs.selectDirectory()
            if (p) onChange(p)
          }}
          title="Browse…"
          className="nodrag shrink-0 flex items-center justify-center w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <input
      type="number"
      value={value as number}
      min={param.min}
      max={param.max}
      step={param.step ?? (param.type === 'float' ? 0.1 : 1)}
      onChange={(e) => onChange(param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
      className={inputCls}
    />
  )
}

// ─── ExtensionNode ────────────────────────────────────────────────────────────

export default function ExtensionNode({ id, data, selected }: { id: string; data: WFNodeData; selected?: boolean }) {
  const { updateNodeData, deleteElements } = useReactFlow()
  const [expanded, setExpanded] = useState(true)
  const ioRowRef = useRef<HTMLDivElement>(null)
  const [handleTop, setHandleTop] = useState('50%')

  useLayoutEffect(() => {
    if (ioRowRef.current) {
      const center = ioRowRef.current.offsetTop + ioRowRef.current.offsetHeight / 2
      setHandleTop(`${center}px`)
    }
  }, [])

  const { modelExtensions, processExtensions } = useExtensionsStore()
  const allExtensions = buildAllWorkflowExtensions(modelExtensions, processExtensions)
  const ext: WorkflowExtension | undefined = allExtensions.find((e) => e.id === data.extensionId)

  const hasParams   = ext && ext.params.length > 0
  const isTerminal  = ext?.id === 'mesh-exporter'
  const inputColor  = HANDLE_COLOR[ext?.input  ?? 'image']
  const outputColor = HANDLE_COLOR[ext?.output ?? 'mesh']

  const toggle = useCallback(() => {
    updateNodeData(id, { enabled: !data.enabled })
  }, [id, data.enabled, updateNodeData])

  const patchParam = useCallback((key: string, val: number | string) => {
    updateNodeData(id, { params: { ...data.params, [key]: val } })
  }, [id, data.params, updateNodeData])

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      className={`relative rounded-xl border bg-zinc-900/95 backdrop-blur-sm shadow-xl transition-all
        ${selected ? 'border-accent/70' : data.enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-50'}`}
    >
      <NodeResizer minWidth={200} minHeight={60} lineStyle={{ borderColor: 'transparent' }} handleStyle={{ background: 'transparent', border: 'none', width: 12, height: 12 }} />
      {/* Input handle - aligned with IO row */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: inputColor, width: 14, height: 14, border: '2.5px solid #18181b', top: handleTop }}
      />

      {/* Header */}
      <div className="flex items-start px-3 pt-3 pb-2.5 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-zinc-200 leading-tight truncate">
            {ext?.name ?? data.extensionId ?? 'Unknown extension'}
          </p>
          {ext?.builtin && (
            <span className="inline-block mt-0.5 text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-700/70 text-zinc-400 border border-zinc-600/50">
              built-in
            </span>
          )}
        </div>

        {/* Toggle enable */}
        <button
          onClick={toggle}
          title={data.enabled ? 'Disable' : 'Enable'}
          className="nodrag relative shrink-0 mt-0.5"
          style={{ width: 26, height: 15 }}
        >
          <span className={`absolute inset-0 rounded-full transition-colors ${data.enabled ? 'bg-accent/70' : 'bg-zinc-700'}`} />
          <span className={`absolute top-[1.5px] w-3 h-3 rounded-full bg-white shadow transition-all ${data.enabled ? 'left-[11px]' : 'left-[1.5px]'}`} />
        </button>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="nodrag p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="nodrag p-0.5 rounded text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-0.5"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* IO row - above params, handles align here */}
      <div ref={ioRowRef} className="flex items-center justify-between px-4 py-2 border-t border-zinc-800/60">
        <span className="text-[9px]" style={{ color: inputColor }}>{ext?.input ?? '—'}</span>
        {!isTerminal && (
          <>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
            <span className="text-[9px]" style={{ color: outputColor }}>{ext?.output ?? '—'}</span>
          </>
        )}
      </div>

      {/* Params */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-800 pt-2.5 flex flex-col gap-2">
          {hasParams ? ext.params.map((param) => {
            const val = (data.params[param.id] ?? param.default) as number | string
            return (
              <div key={param.id} className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-500 w-20 shrink-0 truncate">{param.label}</label>
                <div className="flex-1">
                  <ParamControl param={param} value={val} onChange={(v) => patchParam(param.id, v)} />
                </div>
              </div>
            )
          }) : (
            <p className="text-[10px] text-zinc-600 italic">No parameters</p>
          )}
        </div>
      )}

      {/* Output handle - aligned with IO row */}
      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: outputColor, width: 14, height: 14, border: '2.5px solid #18181b', top: handleTop }}
        />
      )}
    </div>
  )
}
