import { Worker } from 'worker_threads'

// ─── Worker code (eval: true — no external file needed) ──────────────────────

const WORKER_CODE = /* js */ `
const { workerData, parentPort } = require('worker_threads')
const path = require('path')
const Module = require('module')

// Resolve modules from the extension's own node_modules
const require_ext = Module.createRequire(path.join(workerData.extDir, '_'))

let processor
try {
  processor = require_ext(path.join(workerData.extDir, workerData.entry))
  if (typeof processor !== 'function') {
    throw new Error('processor.js must export a function as module.exports')
  }
} catch (err) {
  parentPort.postMessage({ type: 'error', message: 'Failed to load processor: ' + String(err) })
  process.exit(1)
}

parentPort.postMessage({ type: 'ready' })

parentPort.on('message', async (msg) => {
  if (msg.action !== 'run') return
  try {
    const context = {
      workspaceDir: workerData.workspaceDir,
      tempDir:      workerData.tempDir,
      log:      (m)         => parentPort.postMessage({ type: 'log',      message: String(m) }),
      progress: (pct, label) => parentPort.postMessage({ type: 'progress', percent: pct, label }),
    }
    const result = await processor(msg.input, msg.params, context)
    parentPort.postMessage({ type: 'done', result })
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: String(err) })
  }
})
`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessInput {
  filePath?: string
  text?:     string
}

export interface ProcessResult {
  filePath?: string
  text?:     string
}

// ─── ProcessRunner ────────────────────────────────────────────────────────────

export class ProcessRunner {
  private worker:   Worker | null = null
  private ready:    boolean       = false
  private extDir:   string
  private entry:    string
  private workspaceDir: string
  private tempDir:  string

  constructor(extDir: string, entry: string, workspaceDir: string, tempDir: string) {
    this.extDir       = extDir
    this.entry        = entry
    this.workspaceDir = workspaceDir
    this.tempDir      = tempDir
  }

  private async ensureReady(): Promise<void> {
    if (this.ready && this.worker) return

    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_CODE, {
        eval: true,
        workerData: {
          extDir:       this.extDir,
          entry:        this.entry,
          workspaceDir: this.workspaceDir,
          tempDir:      this.tempDir,
        },
      })

      worker.once('message', (msg) => {
        if (msg.type === 'ready') {
          this.worker = worker
          this.ready  = true
          resolve()
        } else if (msg.type === 'error') {
          worker.terminate()
          reject(new Error(msg.message))
        }
      })

      worker.once('error', (err) => {
        reject(err)
      })
    })
  }

  async run(
    input:  ProcessInput,
    params: Record<string, unknown>,
    onProgress?: (percent: number, label: string) => void,
    onLog?:      (message: string) => void,
  ): Promise<ProcessResult> {
    await this.ensureReady()
    const worker = this.worker!

    return new Promise((resolve, reject) => {
      const handler = (msg: { type: string; result?: ProcessResult; message?: string; percent?: number; label?: string }) => {
        if (msg.type === 'progress') {
          onProgress?.(msg.percent ?? 0, msg.label ?? '')
        } else if (msg.type === 'log') {
          onLog?.(msg.message ?? '')
        } else if (msg.type === 'done') {
          worker.off('message', handler)
          resolve(msg.result ?? {})
        } else if (msg.type === 'error') {
          worker.off('message', handler)
          reject(new Error(msg.message))
        }
      }

      worker.on('message', handler)
      worker.postMessage({ action: 'run', input, params })
    })
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready  = false
  }
}

// ─── Registry (one runner per extension id, reused across calls) ──────────────

const registry = new Map<string, ProcessRunner>()

export function getProcessRunner(
  extensionId:  string,
  extDir:       string,
  entry:        string,
  workspaceDir: string,
  tempDir:      string,
): ProcessRunner {
  if (!registry.has(extensionId)) {
    registry.set(extensionId, new ProcessRunner(extDir, entry, workspaceDir, tempDir))
  }
  return registry.get(extensionId)!
}

export function terminateProcessRunner(extensionId: string): void {
  registry.get(extensionId)?.terminate()
  registry.delete(extensionId)
}

export function terminateAllProcessRunners(): void {
  for (const runner of registry.values()) runner.terminate()
  registry.clear()
}
