import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,

  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import { useWorkflowsStore } from '@shared/stores/workflowsStore'
import { useExtensionsStore } from '@shared/stores/extensionsStore'
import { useNavStore } from '@shared/stores/navStore'
import type { Workflow, WFNode, WFEdge, WFNodeData } from '@shared/types/electron.d'
import { buildAllWorkflowExtensions, getWorkflowExtension } from './mockExtensions'
import type { WorkflowExtension } from './mockExtensions'
import { useWorkflowRunner } from './useWorkflowRunner'
import ExtensionNode from './nodes/ExtensionNode'
import InputNode     from './nodes/InputNode'
import ImageNode     from './nodes/ImageNode'
import TextNode      from './nodes/TextNode'
import AddToSceneNode from './nodes/AddToSceneNode'
import WorkflowEdge  from './nodes/WorkflowEdge'

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAG_KEY      = 'modly/extension-id'
const DRAG_NODE_KEY = 'modly/node-type'
const NODE_TYPES = { extensionNode: ExtensionNode, inputNode: InputNode, imageNode: ImageNode, textNode: TextNode, outputNode: AddToSceneNode }
const EDGE_TYPES = { workflowEdge: WorkflowEdge }

const DEFAULT_EDGE_OPTS = { type: 'workflowEdge' }

// ─── IO badge ─────────────────────────────────────────────────────────────────

const IO_STYLES: Record<'image' | 'text' | 'mesh', string> = {
  image: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  mesh:  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  text:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

function IoBadge({ type }: { type: 'image' | 'text' | 'mesh' }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${IO_STYLES[type]}`}>
      {type}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string { return crypto.randomUUID() }

function newWorkflow(): Workflow {
  const now = new Date().toISOString()
  const id  = newId()
  return {
    id,
    name:        'New Workflow',
    description: '',
    nodes: [{
      id:       `input-${id}`,
      type:     'inputNode',
      position: { x: 250, y: 50 },
      data:     { inputType: 'image', enabled: true, params: {} },
    }],
    edges:     [],
    createdAt: now,
    updatedAt: now,
  }
}

// ─── Workflow card (sidebar) ──────────────────────────────────────────────────

function WorkflowCard({ workflow, active, onClick }: { workflow: Workflow; active: boolean; onClick: () => void }) {
  const extCount = workflow.nodes.filter((n) => n.type === 'extensionNode').length
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
        active
          ? 'bg-accent/10 border-accent/30 text-zinc-100'
          : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40'
      }`}
    >
      <p className="text-xs font-semibold truncate">{workflow.name || 'Untitled'}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-zinc-500">{extCount} node{extCount !== 1 ? 's' : ''}</span>
      </div>
    </button>
  )
}

// ─── Extensions panel ────────────────────────────────────────────────────────

const PANEL_MIN = 240
const PANEL_MAX = 860

function ExtensionsPanel({ allExtensions }: { allExtensions: WorkflowExtension[] }) {
  const [search, setSearch] = useState('')
  const [width, setWidth]               = useState(288)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      setWidth((w) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, startW.current + delta)))
    }
    const onUp = () => { dragging.current = false; document.body.style.cursor = '' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const cols      = width >= 580 ? 3 : width >= 370 ? 2 : 1
  const gridClass = cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1'
  const query     = search.trim().toLowerCase()
  const visible   = allExtensions.filter((e) => !query || e.name.toLowerCase().includes(query))

  return (
    <div className="flex shrink-0 border-l border-zinc-800" style={{ width }}>
      {/* Resize handle */}
      <div
        onMouseDown={(e) => {
          dragging.current = true; startX.current = e.clientX; startW.current = width
          document.body.style.cursor = 'col-resize'; e.preventDefault()
        }}
        className="w-1 shrink-0 hover:bg-zinc-600 active:bg-accent/60 cursor-col-resize transition-colors self-stretch"
      />

      <div className="flex flex-col flex-1 min-w-0 bg-zinc-950/30">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-300">Extensions</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">Drag onto canvas</p>
        </div>

        {allExtensions.length > 0 && (
          <div className="px-3 pt-2.5 pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 focus-within:border-zinc-600">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500 shrink-0">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search extensions…"
                className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none min-w-0"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
          {/* Built-in nodes */}
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Nodes</p>
            <div className={`grid ${gridClass} gap-2`}>
              {[
                { type: 'imageNode',  label: 'Image',  color: '#38bdf8', icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
                { type: 'textNode',   label: 'Text',   color: '#fbbf24', icon: <><path d="M17 6.1H3M21 12.1H3M15.1 18H3"/></> },
                { type: 'outputNode', label: 'Add to Scene', color: '#a78bfa', icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></> },
              ].map(({ type, label, color, icon }) => (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG_NODE_KEY, type); e.dataTransfer.effectAllowed = 'copy' }}
                  className="flex flex-col gap-1.5 px-3 py-3 rounded-lg border border-zinc-800 bg-zinc-900 transition-colors cursor-grab hover:bg-zinc-800/60 hover:border-zinc-700 active:cursor-grabbing"
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className="shrink-0">{icon}</svg>
                    <p className="text-[11px] font-semibold text-zinc-200 truncate">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extensions */}
          {allExtensions.length === 0 ? (
            <p className="text-[11px] text-zinc-600 text-center pt-2">No extensions installed</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Extensions</p>
              <div className={`grid ${gridClass} gap-2`}>
              {visible.map((ext) => (
                  <div
                    key={ext.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData(DRAG_KEY, ext.id); e.dataTransfer.effectAllowed = 'copy' }}
                    className="flex flex-col gap-1.5 px-3 py-3 rounded-lg border border-zinc-800 bg-zinc-900 transition-colors cursor-grab hover:bg-zinc-800/60 hover:border-zinc-700 active:cursor-grabbing"
                  >
                    <p className="text-[11px] font-semibold text-zinc-200 truncate">{ext.name}</p>
                    {ext.builtin && (
                      <span className="self-start text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-zinc-700/60 text-zinc-400">built-in</span>
                    )}
                    {ext.description && cols === 1 && (
                      <p className="text-[10px] text-zinc-500 leading-relaxed">{ext.description}</p>
                    )}
                    <div className="flex justify-end mt-0.5">
                      <div className="flex items-center gap-1">
                        <IoBadge type={ext.input} />
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 shrink-0">
                          <path d="M5 12h14M13 6l6 6-6 6"/>
                        </svg>
                        <IoBadge type={ext.output} />
                      </div>
                    </div>
                  </div>
              ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Workflow canvas (inner, requires ReactFlowProvider) ──────────────────────

function WorkflowCanvasInner({
  workflow, allExtensions, onSave, onDelete, onExport,
}: {
  workflow:      Workflow
  allExtensions: WorkflowExtension[]
  onSave:        (w: Workflow) => void
  onDelete:      () => void
  onExport:      () => void
}) {
  const { navigate }        = useNavStore()
  const { screenToFlowPosition, updateNodeData } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges as Edge[])
  const [name, setName]       = useState(workflow.name)
  const [editingName, setEditingName] = useState(false)
  const [inputImage, setInputImage]   = useState<{ path: string; data?: string } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { runState, run, cancel, reset } = useWorkflowRunner(allExtensions)

  // Re-sync when workflow switches
  useEffect(() => {
    setNodes(workflow.nodes as Node[])
    setEdges(workflow.edges as Edge[])
    setName(workflow.name)
  }, [workflow.id])

  // Update output node when run completes
  useEffect(() => {
    if (runState.status !== 'done' || !runState.outputUrl) return
    const outputNode = nodes.find((n) => n.type === 'outputNode')
    if (outputNode) updateNodeData(outputNode.id, { params: { outputUrl: runState.outputUrl } })
  }, [runState.status, runState.outputUrl])

  // Auto-save debounced
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const updated: Workflow = {
        ...workflow,
        name,
        nodes: nodes as WFNode[],
        edges: edges as WFEdge[],
        updatedAt: new Date().toISOString(),
      }
      onSave(updated)
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [nodes, edges, name])

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, ...DEFAULT_EDGE_OPTS }, eds))
  }, [setEdges])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    const nodeType = e.dataTransfer.getData(DRAG_NODE_KEY)
    if (nodeType) {
      setNodes((nds) => [...nds, {
        id: newId(), type: nodeType, position,
        data: { enabled: true, params: {} } as WFNodeData,
      }])
      return
    }

    const extensionId = e.dataTransfer.getData(DRAG_KEY)
    if (!extensionId) return
    setNodes((nds) => [...nds, {
      id: newId(), type: 'extensionNode', position,
      data: { extensionId, enabled: true, params: {} } as WFNodeData,
    }])
  }, [screenToFlowPosition, setNodes])

  const handleRun = useCallback(() => {
    const wf: Workflow = { ...workflow, name, nodes: nodes as WFNode[], edges: edges as WFEdge[] }
    const inputNode = wf.nodes.find((n) => n.type === 'inputNode')
    if (inputNode?.data.inputType === 'image' && !inputImage) return
    reset()
    run(wf, inputImage?.path ?? '', inputImage?.data)
  }, [workflow, name, nodes, edges, inputImage, run, reset])

  const addInputNode = useCallback(() => {
    const existing = nodes.find((n) => n.type === 'inputNode')
    if (existing) return
    const node: Node = {
      id:       `input-${newId()}`,
      type:     'inputNode',
      position: { x: 250, y: 50 },
      data:     { inputType: 'image', enabled: true, params: {} } as WFNodeData,
    }
    setNodes((nds) => [node, ...nds])
  }, [nodes, setNodes])

  // Check if we need an image for run
  const inputNode = nodes.find((n) => n.type === 'inputNode')
  const inputType = (inputNode?.data as WFNodeData | undefined)?.inputType ?? 'image'
  const needsImage = inputType === 'image'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 shrink-0 bg-zinc-950/20">
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
            className="flex-1 bg-transparent border-b border-accent/60 text-sm font-semibold text-zinc-200 focus:outline-none pb-0.5"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="flex-1 text-left text-sm font-semibold text-zinc-200 hover:text-white truncate">
            {name || 'Untitled'}
          </button>
        )}

        {/* Image picker for run */}
        {needsImage && (
          <button
            onClick={async () => {
              const p = await window.electron.fs.selectImage()
              if (!p) return
              const d = await window.electron.fs.readFileBase64(p)
              setInputImage({ path: p, data: d })
            }}
            title="Select input image"
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${
              inputImage ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-400' : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            {inputImage ? inputImage.path.split(/[\\/]/).pop() : 'No image'}
          </button>
        )}

        <div className="flex items-center gap-1">
          {/* Run / Cancel */}
          <button
            onClick={runState.status === 'running' ? cancel : handleRun}
            disabled={runState.status !== 'running' && needsImage && !inputImage}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              runState.status === 'running'
                ? 'bg-red-950/30 border-red-800/40 text-red-400 hover:bg-red-950/50'
                : 'bg-accent/10 border-accent/30 text-accent-light hover:bg-accent/20 hover:border-accent/50'
            }`}
          >
            {runState.status === 'running' ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
                <span className="text-[11px] font-semibold">Cancel</span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span className="text-[11px] font-semibold">Run</span>
              </>
            )}
          </button>

          {/* Add Input Node */}
          <button
            onClick={addInputNode}
            disabled={!!nodes.find((n) => n.type === 'inputNode')}
            title="Add Input Node"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
            title="Export JSON"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 border border-zinc-800 hover:border-red-800/40 transition-colors"
            title="Delete workflow"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Run status bar */}
      {runState.status !== 'idle' && (
        <div className={`px-4 py-2.5 border-b border-zinc-800 shrink-0 ${
          runState.status === 'done'  ? 'bg-emerald-950/25' :
          runState.status === 'error' ? 'bg-red-950/25'     : 'bg-zinc-950/60'
        }`}>
          {runState.status === 'running' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">
                  Node {runState.blockIndex + 1}/{runState.blockTotal} — {runState.blockStep}
                </span>
                <span className="text-[10px] text-zinc-600">{runState.blockProgress}%</span>
              </div>
              <div className="h-0.5 rounded-full bg-zinc-800">
                <div className="h-0.5 rounded-full bg-accent transition-all duration-500" style={{ width: `${runState.blockProgress}%` }} />
              </div>
            </div>
          )}
          {runState.status === 'done' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 font-medium">✓ Complete</span>
              {runState.outputUrl && (
                <button onClick={() => navigate('workspace')} className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors">
                  View in workspace →
                </button>
              )}
              {runState.outputPath && (
                <span className="text-[10px] text-zinc-500 truncate max-w-[260px]" title={runState.outputPath}>
                  {runState.outputPath.split(/[\\/]/).pop()}
                </span>
              )}
            </div>
          )}
          {runState.status === 'error' && (
            <span className="text-[10px] text-red-400">{runState.error}</span>
          )}
        </div>
      )}

      {/* React Flow canvas */}
      <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          defaultEdgeOptions={DEFAULT_EDGE_OPTS}
          deleteKeyCode="Delete"
          connectionLineStyle={{ stroke: '#71717a', strokeWidth: 1.5 }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          className="bg-[#0f0f10]"
        >
          <Background color="#27272a" gap={24} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage(): JSX.Element {
  const { workflows, loading, activeId, load, save, remove, importFile, exportFile, setActive } = useWorkflowsStore()
  const { modelExtensions, processExtensions, loadExtensions } = useExtensionsStore()

  const allExtensions = useMemo(
    () => buildAllWorkflowExtensions(modelExtensions, processExtensions),
    [modelExtensions, processExtensions],
  )

  useEffect(() => { load(); loadExtensions() }, [])

  const activeWorkflow = workflows.find((w) => w.id === activeId) ?? null

  async function handleCreate() {
    const wf = newWorkflow()
    await save(wf)
    setActive(wf.id)
  }

  async function handleImport() {
    const result = await importFile()
    if (result.success && result.workflow) setActive((result.workflow as Workflow).id)
  }


  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Left sidebar */}
      <div className="flex flex-col w-52 shrink-0 border-r border-zinc-800 bg-zinc-950/30">
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
          <h1 className="text-xs font-semibold text-zinc-300">Workflows</h1>
          <div className="flex items-center gap-1">
            <button onClick={handleImport} title="Import" className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
            <button onClick={handleCreate} title="New workflow" className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {loading ? (
            <p className="text-[11px] text-zinc-600 text-center mt-6">Loading…</p>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-10 gap-2 text-zinc-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                <rect x="3" y="3" width="6" height="5" rx="1"/><rect x="3" y="11" width="6" height="5" rx="1"/>
                <path d="M9 5.5h3.5a1 1 0 0 1 1 1v5"/><rect x="13" y="9" width="8" height="7" rx="1"/>
              </svg>
              <p className="text-xs text-center">No workflows yet.<br />Create one to get started.</p>
            </div>
          ) : workflows.map((wf) => (
            <WorkflowCard key={wf.id} workflow={wf} active={wf.id === activeId} onClick={() => setActive(wf.id)} />
          ))}
        </div>
      </div>

      {/* Center: canvas area */}
      <div className="flex flex-1 overflow-hidden">
        {activeWorkflow ? (
          <ReactFlowProvider>
            <WorkflowCanvasInner
              key={activeWorkflow.id}
              workflow={activeWorkflow}
              allExtensions={allExtensions}
              onSave={save}
              onDelete={() => { remove(activeWorkflow.id) }}
              onExport={() => exportFile(activeWorkflow)}
            />
          </ReactFlowProvider>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-zinc-600 gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="6" height="5" rx="1"/><rect x="3" y="11" width="6" height="5" rx="1"/>
              <path d="M9 5.5h3.5a1 1 0 0 1 1 1v5"/><rect x="13" y="9" width="8" height="7" rx="1"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium">Open a workflow</p>
              <p className="text-xs mt-1">or create a new one</p>
            </div>
            <button onClick={handleCreate} className="mt-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors">
              New Workflow
            </button>
          </div>
        )}
      </div>

      {/* Right: Extensions panel */}
      <ExtensionsPanel allExtensions={allExtensions} />
    </div>
  )
}
