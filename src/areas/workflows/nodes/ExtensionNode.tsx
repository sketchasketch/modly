import { useCallback, useRef, useLayoutEffect, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { useExtensionsStore } from '@shared/stores/extensionsStore'
import { buildAllWorkflowExtensions } from '../mockExtensions'
import type { ParamSchema } from '../mockExtensions'
import type { WFNodeData } from '@shared/types/electron.d'
import { useWorkflowRunStore } from '../workflowRunStore'
import BaseNode from './BaseNode'

// ─── Handle colors ────────────────────────────────────────────────────────────

const HANDLE_COLOR: Record<string, string> = {
  image: '#38bdf8',
  mesh:  '#a78bfa',
  text:  '#fbbf24',
}

const TAG_CLS: Record<string, string> = {
  image: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  mesh:  'border-violet-500/30 bg-violet-500/10 text-violet-400',
  text:  'border-amber-500/30 bg-amber-500/10 text-amber-400',
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
        <input type="text" value={value as string} placeholder={param.tooltip ?? ''}
          onChange={(e) => onChange(e.target.value)} className={`${inputCls} flex-1`} />
        <button
          onClick={async () => {
            const p = await window.electron.fs.selectDirectory()
            if (p) onChange(p)
          }}
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
    <input type="number" lang="en" value={value as number} min={param.min} max={param.max}
      step={param.step ?? (param.type === 'float' ? 0.1 : 1)}
      onChange={(e) => onChange(param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
      className={inputCls} />
  )
}

// ─── ExtensionNode ────────────────────────────────────────────────────────────

export default function ExtensionNode({ id, data, selected }: { id: string; data: WFNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow()
  const running = useWorkflowRunStore((s) => s.activeNodeId === id)
  const ioRowRef           = useRef<HTMLDivElement>(null)
  const [handleTop, setHandleTop] = useState('50%')

  // Align handles with the IO row
  useLayoutEffect(() => {
    if (ioRowRef.current) {
      const center = ioRowRef.current.offsetTop + ioRowRef.current.offsetHeight / 2
      setHandleTop(`${center}px`)
    }
  }, [])

  const { modelExtensions, processExtensions } = useExtensionsStore()
  const ext = buildAllWorkflowExtensions(modelExtensions, processExtensions)
    .find((e) => e.id === data.extensionId)

  const isTerminal  = ext?.id === 'mesh-exporter'
  const inputColor  = HANDLE_COLOR[ext?.input  ?? 'image']
  const outputColor = HANDLE_COLOR[ext?.output ?? 'mesh']
  const hasParams   = (ext?.params.length ?? 0) > 0

  const patchParam = useCallback((key: string, val: number | string) => {
    updateNodeData(id, { params: { ...data.params, [key]: val } })
  }, [id, data.params, updateNodeData])

  return (
    <BaseNode
      id={id}
      selected={selected}
      running={running}
      title={ext?.name ?? data.extensionId ?? 'Unknown extension'}
      enabled={data.enabled}
      showInGenerate={data.showInGenerate ?? false}
      collapsible={hasParams}
      minWidth={200}
      subheader={
        <div ref={ioRowRef} className="flex items-center justify-between px-3 py-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${TAG_CLS[ext?.input ?? ''] ?? 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>
            {ext?.input ?? '—'}
          </span>
          {!isTerminal && (
            <>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 shrink-0">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${TAG_CLS[ext?.output ?? ''] ?? 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>
                {ext?.output ?? '—'}
              </span>
            </>
          )}
        </div>
      }
      handles={<>
        <Handle type="target" position={Position.Left}
          style={{ background: inputColor, width: 14, height: 14, border: '2.5px solid #18181b', top: handleTop }} />
        {!isTerminal && (
          <Handle type="source" position={Position.Right}
            style={{ background: outputColor, width: 14, height: 14, border: '2.5px solid #18181b', top: handleTop }} />
        )}
      </>}
    >
      {hasParams && (
        <div className="px-3 pb-3 pt-2.5 flex flex-col gap-2">
          {ext!.params.map((param) => {
            const val = (data.params[param.id] ?? param.default) as number | string
            return (
              <div key={param.id} className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-500 w-20 shrink-0 truncate">{param.label}</label>
                <div className="flex-1">
                  <ParamControl param={param} value={val} onChange={(v) => patchParam(param.id, v)} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </BaseNode>
  )
}
