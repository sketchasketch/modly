import { useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { useAppStore } from '@shared/stores/appStore'
import type { Workflow, WFNode, WFEdge } from '@shared/types/electron.d'
import { getWorkflowExtension } from './mockExtensions'
import type { WorkflowExtension } from './mockExtensions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowRunState {
  status:        'idle' | 'running' | 'done' | 'error'
  blockIndex:    number
  blockTotal:    number
  blockProgress: number
  blockStep:     string
  outputUrl?:    string
  outputPath?:   string
  error?:        string
}

const IDLE: WorkflowRunState = {
  status: 'idle', blockIndex: 0, blockTotal: 0, blockProgress: 0, blockStep: '',
}

// ─── Topological sort (Kahn's algorithm) ─────────────────────────────────────

function topoSort(nodes: WFNode[], edges: WFEdge[]): WFNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const adj = new Map(nodes.map((n) => [n.id, [] as string[]]))

  for (const e of edges) {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0)
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkflowRunner(allExtensions: WorkflowExtension[]) {
  const apiUrl      = useAppStore((s) => s.apiUrl)
  const [runState, setRunState] = useState<WorkflowRunState>(IDLE)
  const cancelRef   = useRef(false)
  const activeJobId = useRef<string | null>(null)

  const run = useCallback(async (
    workflow:   Workflow,
    imagePath:  string,
    imageData?: string,
  ) => {
    cancelRef.current = false

    const ordered = topoSort(workflow.nodes, workflow.edges)
    // Skip the inputNode (first node with type 'inputNode')
    const execNodes = ordered.filter((n) => n.type === 'extensionNode' && n.data.enabled)

    setRunState({
      status: 'running', blockIndex: 0, blockTotal: execNodes.length,
      blockProgress: 0, blockStep: 'Starting…',
    })

    try {
      const client       = axios.create({ baseURL: apiUrl })
      const settings     = await window.electron.settings.get()
      const workspaceDir = settings.workspaceDir.replace(/\\/g, '/')

      let currentFilePath: string | undefined = imagePath
      let currentText:     string | undefined = undefined

      for (let i = 0; i < execNodes.length; i++) {
        if (cancelRef.current) { setRunState(IDLE); return }

        const node = execNodes[i]
        const ext  = getWorkflowExtension(node.data.extensionId ?? '', allExtensions)

        setRunState((s) => ({ ...s, blockIndex: i, blockProgress: 0, blockStep: 'Starting…' }))

        if (ext?.input === 'image' && ext?.output === 'mesh') {
          // ── Generator: call Python FastAPI ──────────────────────────────────
          const base64 = imageData ?? await window.electron.fs.readFileBase64(imagePath)
          const bytes  = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const blob   = new Blob([bytes], { type: 'image/png' })
          const fname  = imagePath.split(/[\\/]/).pop() ?? 'image.png'

          const fd = new FormData()
          fd.append('image', blob, fname)
          fd.append('model_id', node.data.extensionId ?? '')
          fd.append('collection', 'Workflows')
          fd.append('remesh', 'none')
          fd.append('enable_texture', 'false')
          fd.append('texture_resolution', '1024')
          fd.append('params', JSON.stringify(node.data.params))

          setRunState((s) => ({ ...s, blockProgress: 5, blockStep: 'Submitting to model…' }))

          const { data } = await client.post<{ job_id: string }>(
            '/generate/from-image', fd,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          )
          const jobId = data.job_id
          activeJobId.current = jobId

          while (true) {
            if (cancelRef.current) {
              await client.post(`/generate/cancel/${jobId}`).catch(() => {})
              activeJobId.current = null
              setRunState(IDLE)
              return
            }
            await new Promise((r) => setTimeout(r, 1200))

            const { data: st } = await client.get<{
              status: string; progress?: number; step?: string
              output_url?: string; error?: string
            }>(`/generate/status/${jobId}`)

            if (st.status === 'done' && st.output_url) {
              const rel = st.output_url.replace(/^\/workspace\//, '')
              currentFilePath = `${workspaceDir}/${rel}`
              activeJobId.current = null
              setRunState((s) => ({ ...s, blockProgress: 100, blockStep: 'Generation complete' }))
              break
            }
            if (st.status === 'error') throw new Error(st.error ?? 'Generation failed')

            setRunState((s) => ({
              ...s,
              blockProgress: st.progress ?? s.blockProgress,
              blockStep:     st.step     ?? 'Generating…',
            }))
          }

        } else {
          // ── Process extension ────────────────────────────────────────────────
          const result = await window.electron.extensions.runProcess(
            node.data.extensionId ?? '',
            { filePath: currentFilePath, text: currentText },
            node.data.params as Record<string, unknown>,
          )
          if (!result.success) throw new Error(result.error ?? 'Process extension failed')
          currentFilePath = result.result?.filePath ?? currentFilePath
          currentText     = result.result?.text     ?? currentText
          setRunState((s) => ({ ...s, blockProgress: 100, blockStep: 'Done' }))
        }
      }

      let outputUrl:  string | undefined
      let outputPath: string | undefined

      if (currentFilePath) {
        const norm = currentFilePath.replace(/\\/g, '/')
        if (norm.startsWith(workspaceDir)) {
          const rel = norm.slice(workspaceDir.length).replace(/^\//, '')
          outputUrl = `/workspace/${rel}`
        } else {
          outputPath = currentFilePath
        }
      }

      setRunState({
        status: 'done',
        blockIndex:    execNodes.length - 1,
        blockTotal:    execNodes.length,
        blockProgress: 100,
        blockStep:     'Done',
        outputUrl,
        outputPath,
      })

    } catch (err) {
      if (!cancelRef.current) {
        setRunState((s) => ({ ...s, status: 'error', error: String(err) }))
      }
    }
  }, [apiUrl, allExtensions])

  const cancel = useCallback(() => {
    cancelRef.current = true
    if (activeJobId.current) {
      const client = axios.create({ baseURL: apiUrl })
      client.post(`/generate/cancel/${activeJobId.current}`).catch(() => {})
      activeJobId.current = null
    }
    setRunState(IDLE)
  }, [apiUrl])

  const reset = useCallback(() => setRunState(IDLE), [])

  return { runState, run, cancel, reset }
}
