import { useState, useRef } from 'react'
import { useAppStore } from '@shared/stores/appStore'
import { useCollectionsStore } from '@shared/stores/collectionsStore'
import { useNavStore } from '@shared/stores/navStore'
import { ConfirmModal } from '@shared/components/ui'
import { WorkspaceCard } from './components/WorkspaceCard'
import { CollectionItem } from './components/CollectionItem'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkspacePage(): JSX.Element {
  const { currentJob, setCurrentJob } = useAppStore()
  const { collections, activeCollectionId, createCollection, renameCollection, deleteCollection, setActiveCollection, removeFromWorkspace } = useCollectionsStore()
  const navigate = useNavStore((s) => s.navigate)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeleteColId, setPendingDeleteColId] = useState<string | null>(null)
  const [newColName, setNewColName] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const newColRef = useRef<HTMLInputElement>(null)

  const activeCollection = collections.find((c) => c.id === activeCollectionId)

  const handleJobClick = (job: GenerationJob) => {
    // Always restore the original mesh (before any optimization)
    setCurrentJob({ ...job, outputUrl: job.originalOutputUrl ?? job.outputUrl })
    navigate('generate')
  }

  const handleDeleteJobConfirm = () => {
    if (pendingDeleteId) {
      if (currentJob?.id === pendingDeleteId) setCurrentJob(null)
      removeFromWorkspace(pendingDeleteId)
    }
    setPendingDeleteId(null)
  }

  const handleDeleteColConfirm = () => {
    if (pendingDeleteColId) deleteCollection(pendingDeleteColId)
    setPendingDeleteColId(null)
  }

  const handleAddCollection = () => {
    setAddingCol(true)
    setNewColName('')
    setTimeout(() => newColRef.current?.focus(), 0)
  }

  const commitNewCol = () => {
    const name = newColName.trim()
    if (name) createCollection(name)
    setAddingCol(false)
    setNewColName('')
  }

  const cancelNewCol = () => {
    setAddingCol(false)
    setNewColName('')
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Collections sidebar */}
      <div className="flex flex-col w-60 shrink-0 border-r border-zinc-800 bg-surface-400 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800 shrink-0">
          <span className="text-sm font-semibold text-zinc-200">Collections</span>
          <button
            onClick={handleAddCollection}
            title="New collection"
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {collections.map((col) => (
            <CollectionItem
              key={col.id}
              col={col}
              isActive={col.id === activeCollectionId}
              isOnly={collections.length === 1}
              onSelect={() => setActiveCollection(col.id)}
              onRename={(name) => renameCollection(col.id, name)}
              onDelete={() => setPendingDeleteColId(col.id)}
            />
          ))}

          {addingCol && (
            <div className="px-3 py-2">
              <input
                ref={newColRef}
                value={newColName}
                placeholder="Collection name…"
                className="w-full bg-zinc-700 text-zinc-100 text-sm px-2 py-1 rounded outline-none border border-accent/50"
                onChange={(e) => setNewColName(e.target.value)}
                onBlur={commitNewCol}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewCol() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelNewCol() }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Job grid panel */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800 shrink-0">
          <h1 className="text-base font-semibold text-zinc-100">
            {activeCollection?.name ?? 'Workspace'}
          </h1>
          {activeCollection && activeCollection.jobs.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded-md">
              {activeCollection.jobs.length}
            </span>
          )}
        </div>

        {/* Content */}
        {!activeCollection || activeCollection.jobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-zinc-800">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-500">No generations yet</p>
              <p className="text-xs text-zinc-700 mt-1">Your generated 3D models will appear here</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-4 gap-4 2xl:grid-cols-6 items-start">
              {activeCollection.jobs.map((job) => (
                <WorkspaceCard
                  key={job.id}
                  job={job}
                  isActive={currentJob?.id === job.id}
                  onClick={() => handleJobClick(job)}
                  onDelete={() => setPendingDeleteId(job.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {pendingDeleteId && (
        <ConfirmModal
          title="Delete this generation?"
          description="This will remove it from the collection. This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeleteJobConfirm}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {pendingDeleteColId && (
        <ConfirmModal
          title="Delete this collection?"
          description="All generations in this collection will be removed. This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeleteColConfirm}
          onCancel={() => setPendingDeleteColId(null)}
        />
      )}
    </div>
  )
}
