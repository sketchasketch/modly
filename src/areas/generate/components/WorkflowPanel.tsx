import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  useNodesState, useEdgesState, useReactFlow,
  type Node as FlowNode, type Edge as FlowEdge,
} from '@xyflow/react'
import { useWorkflowsStore }    from '@shared/stores/workflowsStore'
import { useAppStore }          from '@shared/stores/appStore'
import { useExtensionsStore }   from '@shared/stores/extensionsStore'
import { useCollectionsStore }  from '@shared/stores/collectionsStore'
import { useWorkflowRunner }    from '@areas/workflows/useWorkflowRunner'
import { buildAllWorkflowExtensions, getWorkflowExtension } from '@areas/workflows/mockExtensions'
import type { Workflow, WFNode, WFEdge } from '@shared/types/electron.d'
import ExtensionNode  from '@areas/workflows/nodes/ExtensionNode'
import InputNode      from '@areas/workflows/nodes/InputNode'
import ImageNode      from '@areas/workflows/nodes/ImageNode'
import TextNode       from '@areas/workflows/nodes/TextNode'
import AddToSceneNode from '@areas/workflows/nodes/AddToSceneNode'
import WorkflowEdge   from '@areas/workflows/nodes/WorkflowEdge'

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_TYPES = {
  extensionNode: ExtensionNode,
  inputNode:     InputNode,
  imageNode:     ImageNode,
  textNode:      TextNode,
  outputNode:    AddToSceneNode,
}
const EDGE_TYPES       = { workflowEdge: WorkflowEdge }
const DEFAULT_EDGE_OPTS = { type: 'workflowEdge' }

// ─── Topo sort ────────────────────────────────────────────────────────────────

function topoSortNodes(nodes: Workflow['nodes'], edges: Workflow['edges']): WFNode[] {
  const nodeMap  = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const adj      = new Map(nodes.map((n) => [n.id, [] as string[]]))
  for (const e of edges) {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }
  const queue  = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0)
  const result: WFNode[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)
    for (const neighbor of adj.get(node.id) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) queue.push(nodeMap.get(neighbor)!)
    }
  }
  return result
}

// ─── Workflow dropdown ────────────────────────────────────────────────────────

function WorkflowDropdown({ workflows, value, onChange }: {
  workflows: Workflow[]
  value:     string | null
  onChange:  (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const selected        = workflows.find((w) => w.id === value)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  if (workflows.length === 0) {
    return (
      <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 text-xs">
        No workflows yet
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border text-left transition-colors ${open ? 'border-zinc-600' : 'border-zinc-800 hover:border-zinc-700'}`}
      >
        <span className="text-xs font-medium text-zinc-200 truncate">
          {selected?.name ?? 'Select a workflow…'}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 ml-2 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl overflow-hidden">
          {workflows.map((wf, i) => (
            <button
              key={wf.id}
              onClick={() => { onChange(wf.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors
                ${i > 0 ? 'border-t border-zinc-800' : ''}
                ${wf.id === value ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/60'}`}
            >
              <span className="flex-1 truncate">{wf.name}</span>
              <span className="text-[9px] text-zinc-600 shrink-0">
                {wf.nodes.filter((n) => n.type === 'extensionNode').length} nodes
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Embedded canvas ──────────────────────────────────────────────────────────

function EmbeddedCanvas({ workflow, allExtensions }: {
  workflow:      Workflow
  allExtensions: ReturnType<typeof buildAllWorkflowExtensions>
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes as FlowNode[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges as FlowEdge[])
  const { updateNodeData } = useReactFlow()

  const { setCurrentJob, updateCurrentJob, selectedImagePath, selectedImageData } = useAppStore()
  const addToWorkspace = useCollectionsStore((s) => s.addToWorkspace)
  const { runState, run, cancel } = useWorkflowRunner(allExtensions)
  const isRunning = runState.status === 'running'

  // Update AddToScene node when run completes
  useEffect(() => {
    if (runState.status !== 'done' || !runState.outputUrl) return
    const out = nodes.find((n) => n.type === 'outputNode')
    if (out) updateNodeData(out.id, { params: { outputUrl: runState.outputUrl } })
  }, [runState.status, runState.outputUrl])

  // Sync runState → currentJob (for GenerationHUD)
  useEffect(() => {
    if (runState.status === 'running') {
      const total   = runState.blockTotal
      const overall = total > 0
        ? Math.round((runState.blockIndex / total) * 100 + runState.blockProgress / total)
        : runState.blockProgress
      updateCurrentJob({ status: 'generating', progress: overall, step: runState.blockStep })
    } else if (runState.status === 'done') {
      updateCurrentJob({ status: 'done', progress: 100, outputUrl: runState.outputUrl })
      const finalJob = useAppStore.getState().currentJob
      if (finalJob) addToWorkspace(finalJob)
    } else if (runState.status === 'error') {
      updateCurrentJob({ status: 'error', error: runState.error })
    }
  }, [runState])

  // Type mismatch detection
  const typeMismatch = useMemo(() => {
    const sorted   = topoSortNodes(workflow.nodes, workflow.edges)
    const extNodes = sorted.filter((n) => n.type === 'extensionNode')
    const inputNode = sorted.find((n) => n.type === 'inputNode')
    let prev: string = inputNode?.data.inputType ?? 'image'
    for (const node of extNodes) {
      const ext = getWorkflowExtension(node.data.extensionId ?? '', allExtensions)
      if (!ext) continue
      if (prev !== ext.input) return true
      prev = ext.output
    }
    return false
  }, [workflow, allExtensions])

  const handleGenerate = useCallback(() => {
    const imageNode = nodes.find((n) => n.type === 'imageNode')
    const imagePath = (imageNode?.data?.params?.filePath as string | undefined) ?? selectedImagePath ?? ''
    const imageData = selectedImageData ?? undefined

    const hasGenerator = nodes.some((n) => {
      const ext = getWorkflowExtension((n.data?.extensionId as string) ?? '', allExtensions)
      return ext?.input === 'image' && ext?.output === 'mesh'
    })
    if (hasGenerator && !imagePath) return

    setCurrentJob({
      id: crypto.randomUUID(),
      imageFile: imagePath,
      status: 'uploading',
      progress: 0,
      createdAt: Date.now(),
    })

    run(
      { ...workflow, nodes: nodes as WFNode[], edges: edges as WFEdge[] },
      imagePath,
      imageData,
    )
  }, [nodes, edges, workflow, selectedImagePath, selectedImageData, allExtensions, setCurrentJob, run])

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Graph */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          defaultEdgeOptions={DEFAULT_EDGE_OPTS}
          deleteKeyCode={null}
          connectionLineStyle={{ stroke: '#71717a', strokeWidth: 1.5 }}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          className="bg-[#0f0f10]"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
        </ReactFlow>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pt-3 pb-4 border-t border-zinc-800 flex flex-col gap-2">
        {typeMismatch && !isRunning && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-950/40 border border-red-800/50">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-[10px] text-red-400 font-medium">Type mismatch — fix the workflow</span>
          </div>
        )}
        {isRunning ? (
          <button
            onClick={() => { cancel(); setCurrentJob(null) }}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={typeMismatch}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Generate 3D Model
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function WorkflowPanel() {
  const { workflows, load }    = useWorkflowsStore()
  const { modelExtensions, processExtensions } = useExtensionsStore()
  const loadExtensions         = useExtensionsStore((s) => s.loadExtensions)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const allExtensions = useMemo(
    () => buildAllWorkflowExtensions(modelExtensions, processExtensions),
    [modelExtensions, processExtensions],
  )

  useEffect(() => { load(); loadExtensions() }, [])

  useEffect(() => {
    if (!selectedId && workflows.length > 0) setSelectedId(workflows[0].id)
  }, [workflows])

  const workflow = workflows.find((w) => w.id === selectedId) ?? null

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-zinc-800 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Workflow</h2>
        <WorkflowDropdown workflows={workflows} value={selectedId} onChange={setSelectedId} />
      </div>

      {/* Canvas or empty state */}
      {workflow ? (
        <ReactFlowProvider>
          <EmbeddedCanvas
            key={workflow.id}
            workflow={workflow}
            allExtensions={allExtensions}
          />
        </ReactFlowProvider>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-zinc-600 text-center leading-relaxed">
            No workflows yet.<br/>Create one in the Workflows tab.
          </p>
        </div>
      )}
    </div>
  )
}
