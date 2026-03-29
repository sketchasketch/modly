import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '@shared/stores/appStore'
import GenerationHUD from './components/GenerationHUD'
import WorkspacePanel from './components/WorkspacePanel'
import Viewer3D from './components/Viewer3D'
import WorkflowPanel from './components/WorkflowPanel'

const MIN_WIDTH = 220
const MAX_WIDTH = 520
const DEFAULT_WIDTH = 320

export default function GeneratePage(): JSX.Element {
  const [unloadStatus, setUnloadStatus] = useState<'idle' | 'done'>('idle')
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const dragging = useRef(false)
  const isGenerating = useAppStore((s) =>
    s.currentJob?.status === 'uploading' || s.currentJob?.status === 'generating'
  )

  async function handleUnloadAll() {
    await window.electron.model.unloadAll()
    setUnloadStatus('done')
    setTimeout(() => setUnloadStatus('idle'), 2000)
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPanelWidth((w) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w + ev.movementX)))
    }
    const onMouseUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <>
      <div className="flex flex-col border-r border-zinc-800 bg-surface-400 overflow-hidden shrink-0" style={{ width: panelWidth }}>
        <WorkflowPanel />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 shrink-0 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors"
      />

      <div className="flex-1 relative overflow-hidden">
        <Viewer3D />
        <GenerationHUD />
        <WorkspacePanel />

        {/* Free memory button — top-left overlay */}
        <button
          onClick={handleUnloadAll}
          disabled={isGenerating}
          title="Free model from memory"
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-900/70 border border-zinc-700/50 backdrop-blur-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
          {unloadStatus === 'done' ? 'Freed' : 'Free memory'}
        </button>
      </div>
    </>
  )
}
