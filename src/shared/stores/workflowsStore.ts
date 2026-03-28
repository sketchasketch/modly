import { create } from 'zustand'
import type { Workflow } from '@shared/types/electron.d'

interface WorkflowsStore {
  workflows:   Workflow[]
  loading:     boolean
  activeId:    string | null

  load:          () => Promise<void>
  save:          (workflow: Workflow) => Promise<{ success: boolean; error?: string }>
  remove:        (id: string) => Promise<{ success: boolean; error?: string }>
  importFile:    () => Promise<{ success: boolean; error?: string }>
  exportFile:    (workflow: Workflow) => Promise<{ success: boolean; error?: string }>
  setActive:     (id: string | null) => void
}

export const useWorkflowsStore = create<WorkflowsStore>((set, get) => ({
  workflows: [],
  loading:   false,
  activeId:  null,

  async load() {
    set({ loading: true })
    try {
      const list = await window.electron.workflows.list()
      set({ workflows: list, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  async save(workflow) {
    const result = await window.electron.workflows.save(workflow)
    if (result.success) {
      set((s) => {
        const filtered = s.workflows.filter((w) => w.id !== workflow.id)
        return { workflows: [workflow, ...filtered] }
      })
    }
    return result
  },

  async remove(id) {
    const result = await window.electron.workflows.delete(id)
    if (result.success) {
      set((s) => ({
        workflows: s.workflows.filter((w) => w.id !== id),
        activeId:  s.activeId === id ? null : s.activeId,
      }))
    }
    return result
  },

  async importFile() {
    const result = await window.electron.workflows.import()
    if (result.success && result.workflow) {
      const wf = result.workflow as Workflow
      set((s) => {
        const filtered = s.workflows.filter((w) => w.id !== wf.id)
        return { workflows: [wf, ...filtered], activeId: wf.id }
      })
    }
    return result
  },

  async exportFile(workflow) {
    return window.electron.workflows.export(workflow)
  },

  setActive(id) {
    set({ activeId: id })
  },
}))
