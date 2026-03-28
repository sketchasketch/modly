import { useEffect, useState } from 'react'
import { useWorkflowsStore } from '@shared/stores/workflowsStore'
import { useExtensionsStore } from '@shared/stores/extensionsStore'
import type { Workflow, WorkflowBlock } from '@shared/types/electron.d'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID()
}

function newWorkflow(): Workflow {
  const now = new Date().toISOString()
  return {
    id:          newId(),
    name:        'New Workflow',
    description: '',
    input:       'image',
    blocks:      [],
    createdAt:   now,
    updatedAt:   now,
  }
}

function newBlock(extensionId: string): WorkflowBlock {
  return { id: newId(), extension: extensionId, enabled: true, params: {} }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkflowCard({
  workflow, active, onClick,
}: { workflow: Workflow; active: boolean; onClick: () => void }) {
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
        <span className="text-[10px] text-zinc-500 capitalize">{workflow.input}</span>
        <span className="text-[10px] text-zinc-600">·</span>
        <span className="text-[10px] text-zinc-500">{workflow.blocks.length} block{workflow.blocks.length !== 1 ? 's' : ''}</span>
      </div>
    </button>
  )
}

function BlockRow({
  block, extensionName, onToggle, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  block:         WorkflowBlock
  extensionName: string
  onToggle:      () => void
  onRemove:      () => void
  onMoveUp:      () => void
  onMoveDown:    () => void
  isFirst:       boolean
  isLast:        boolean
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      block.enabled ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-800 bg-zinc-900/30 opacity-50'
    }`}>
      {/* Enabled toggle */}
      <button
        onClick={onToggle}
        title={block.enabled ? 'Disable block' : 'Enable block'}
        className={`shrink-0 w-4 h-4 rounded border transition-colors ${
          block.enabled
            ? 'bg-accent border-accent/60'
            : 'bg-transparent border-zinc-600 hover:border-zinc-400'
        }`}
      >
        {block.enabled && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Extension name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate">{extensionName}</p>
        <p className="text-[10px] text-zinc-500 font-mono truncate">{block.extension}</p>
      </div>

      {/* Reorder */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="shrink-0 p-1 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ─── Add Block Picker ─────────────────────────────────────────────────────────

function AddBlockPicker({
  usedExtensions,
  onSelect,
  onClose,
}: {
  usedExtensions: string[]
  onSelect:       (extensionId: string) => void
  onClose:        () => void
}) {
  const extensions = useExtensionsStore((s) => s.extensions)

  // Flatten variants: each model variant is a potential block
  const options = extensions.flatMap((ext) =>
    ext.models.map((m) => ({ id: m.id, name: `${ext.name} — ${m.name}`, extName: ext.name }))
  )

  return (
    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
      {options.length === 0 ? (
        <p className="px-3 py-3 text-xs text-zinc-500">No extensions installed.</p>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onSelect(opt.id); onClose() }}
              disabled={usedExtensions.includes(opt.id)}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="font-medium">{opt.name}</span>
              <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{opt.id}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={onClose}
        className="w-full text-left px-3 py-2 text-[10px] text-zinc-600 hover:text-zinc-400 border-t border-zinc-800"
      >
        Cancel
      </button>
    </div>
  )
}

// ─── Workflow Editor ──────────────────────────────────────────────────────────

function WorkflowEditor({
  workflow,
  onSave,
  onDelete,
  onExport,
}: {
  workflow: Workflow
  onSave:   (w: Workflow) => void
  onDelete: () => void
  onExport: () => void
}) {
  const [draft, setDraft]         = useState<Workflow>(workflow)
  const [showPicker, setShowPicker] = useState(false)
  const [dirty, setDirty]         = useState(false)
  const extensions                = useExtensionsStore((s) => s.extensions)

  useEffect(() => {
    setDraft(workflow)
    setDirty(false)
  }, [workflow.id])

  function patch(partial: Partial<Workflow>) {
    setDraft((d) => ({ ...d, ...partial }))
    setDirty(true)
  }

  function patchBlock(blockId: string, partial: Partial<WorkflowBlock>) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => b.id === blockId ? { ...b, ...partial } : b),
    }))
    setDirty(true)
  }

  function addBlock(extensionId: string) {
    setDraft((d) => ({ ...d, blocks: [...d.blocks, newBlock(extensionId)] }))
    setDirty(true)
  }

  function removeBlock(blockId: string) {
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }))
    setDirty(true)
  }

  function moveBlock(blockId: string, direction: 'up' | 'down') {
    setDraft((d) => {
      const blocks = [...d.blocks]
      const idx    = blocks.findIndex((b) => b.id === blockId)
      const swap   = direction === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= blocks.length) return d;
      [blocks[idx], blocks[swap]] = [blocks[swap], blocks[idx]]
      return { ...d, blocks }
    })
    setDirty(true)
  }

  function handleSave() {
    const saved = { ...draft, updatedAt: new Date().toISOString() }
    onSave(saved)
    setDirty(false)
  }

  function extensionName(extensionId: string): string {
    for (const ext of extensions) {
      const model = ext.models.find((m) => m.id === extensionId)
      if (model) return `${ext.name} — ${model.name}`
    }
    return extensionId
  }

  const usedIds = draft.blocks.map((b) => b.extension)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">Edit Workflow</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            title="Export JSON"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <button
            onClick={onDelete}
            title="Delete workflow"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-800/40 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Delete
          </button>
          {dirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

        {/* Metadata */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Name</label>
              <input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent/60"
                placeholder="Workflow name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Input</label>
              <select
                value={draft.input}
                onChange={(e) => patch({ input: e.target.value as 'image' | 'text' })}
                className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent/60"
              >
                <option value="image">Image</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Description</label>
            <input
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent/60"
              placeholder="Optional description"
            />
          </div>
        </div>

        {/* Blocks */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Pipeline</label>
            <div className="relative">
              <button
                onClick={() => setShowPicker((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add block
              </button>
              {showPicker && (
                <AddBlockPicker
                  usedExtensions={usedIds}
                  onSelect={addBlock}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
          </div>

          {draft.blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-zinc-800 text-zinc-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="mb-2">
                <rect x="3" y="3" width="6" height="5" rx="1" /><rect x="3" y="11" width="6" height="5" rx="1" />
                <path d="M9 5.5h3.5a1 1 0 0 1 1 1v5" />
                <rect x="13" y="9" width="8" height="7" rx="1" />
              </svg>
              <p className="text-xs">No blocks yet — add one above</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {draft.blocks.map((block, idx) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  extensionName={extensionName(block.extension)}
                  onToggle={() => patchBlock(block.id, { enabled: !block.enabled })}
                  onRemove={() => removeBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, 'up')}
                  onMoveDown={() => moveBlock(block.id, 'down')}
                  isFirst={idx === 0}
                  isLast={idx === draft.blocks.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  openIds,
  activeId,
  workflows,
  onActivate,
  onClose,
  onNew,
}: {
  openIds:   string[]
  activeId:  string | null
  workflows: Workflow[]
  onActivate: (id: string) => void
  onClose:    (id: string) => void
  onNew:      () => void
}) {
  return (
    <div className="flex items-end gap-0 border-b border-zinc-800 bg-zinc-950/40 px-1 overflow-x-auto shrink-0">
      {openIds.map((id) => {
        const wf     = workflows.find((w) => w.id === id)
        const active = id === activeId
        return (
          <div
            key={id}
            className={`group flex items-center gap-1.5 px-3 py-2 min-w-0 max-w-[160px] cursor-pointer border-t border-x select-none transition-colors ${
              active
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 border-b-zinc-900 -mb-px z-10'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}
            onClick={() => onActivate(id)}
          >
            <span className="text-[11px] font-medium truncate flex-1">
              {wf?.name || 'Untitled'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(id) }}
              className={`shrink-0 rounded p-0.5 transition-colors ${
                active
                  ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700'
                  : 'text-transparent group-hover:text-zinc-500 hover:!text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}

      {/* New tab button */}
      <button
        onClick={onNew}
        title="New workflow"
        className="flex items-center justify-center w-7 h-7 mb-0.5 ml-0.5 shrink-0 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage(): JSX.Element {
  const { workflows, loading, activeId, load, save, remove, importFile, exportFile, setActive } = useWorkflowsStore()
  const loadExtensions = useExtensionsStore((s) => s.loadExtensions)
  const [openIds, setOpenIds] = useState<string[]>([])

  useEffect(() => {
    load()
    loadExtensions()
  }, [])

  // Keep openIds in sync: remove tabs for deleted workflows
  useEffect(() => {
    const validIds = workflows.map((w) => w.id)
    setOpenIds((prev) => prev.filter((id) => validIds.includes(id)))
  }, [workflows])

  function openTab(id: string) {
    setOpenIds((prev) => prev.includes(id) ? prev : [...prev, id])
    setActive(id)
  }

  function closeTab(id: string) {
    const idx    = openIds.indexOf(id)
    const next   = openIds[idx + 1] ?? openIds[idx - 1] ?? null
    setOpenIds((prev) => prev.filter((i) => i !== id))
    setActive(next)
  }

  const activeWorkflow = workflows.find((w) => w.id === activeId) ?? null

  async function handleCreate() {
    const wf = newWorkflow()
    await save(wf)
    openTab(wf.id)
  }

  async function handleDelete() {
    if (!activeWorkflow) return
    await remove(activeWorkflow.id)
  }

  async function handleImport() {
    const result = await importFile()
    if (result.success && result.workflow) {
      openTab((result.workflow as Workflow).id)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Left panel — workflow list */}
      <div className="flex flex-col w-56 shrink-0 border-r border-zinc-800 bg-zinc-950/30">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
          <h1 className="text-xs font-semibold text-zinc-300">Workflows</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handleImport}
              title="Import workflow"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <button
              onClick={handleCreate}
              title="New workflow"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {loading ? (
            <p className="text-[11px] text-zinc-600 text-center mt-6">Loading…</p>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-10 gap-2 text-zinc-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                <rect x="3" y="3" width="6" height="5" rx="1" /><rect x="3" y="11" width="6" height="5" rx="1" />
                <path d="M9 5.5h3.5a1 1 0 0 1 1 1v5" /><rect x="13" y="9" width="8" height="7" rx="1" />
              </svg>
              <p className="text-xs text-center">No workflows yet.<br />Create one to get started.</p>
            </div>
          ) : (
            workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                active={wf.id === activeId}
                onClick={() => openTab(wf.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — tabs + editor */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TabBar
          openIds={openIds}
          activeId={activeId}
          workflows={workflows}
          onActivate={setActive}
          onClose={closeTab}
          onNew={handleCreate}
        />

        <div className="flex flex-1 overflow-hidden">
          {activeWorkflow ? (
            <WorkflowEditor
              key={activeWorkflow.id}
              workflow={activeWorkflow}
              onSave={save}
              onDelete={handleDelete}
              onExport={() => exportFile(activeWorkflow)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-600 gap-3">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="6" height="5" rx="1" /><rect x="3" y="11" width="6" height="5" rx="1" />
                <path d="M9 5.5h3.5a1 1 0 0 1 1 1v5" /><rect x="13" y="9" width="8" height="7" rx="1" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium">Open a workflow</p>
                <p className="text-xs mt-1">or create a new one</p>
              </div>
              <button
                onClick={handleCreate}
                className="mt-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
              >
                New Workflow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
