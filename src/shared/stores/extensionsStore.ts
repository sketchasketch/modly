import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtensionVariant {
  id:               string
  name:             string
  repoId:           string
  description?:     string
  hfSkipPrefixes?:  string[]
}

export interface Extension {
  id:           string
  name:         string
  version?:     string
  description?: string
  author?:      string
  trusted:      boolean
  models:       ExtensionVariant[]
}

export type InstallStep = 'downloading' | 'extracting' | 'validating' | 'done' | 'error'

export interface InstallProgress {
  step:         InstallStep
  percent?:     number
  extensionId?: string
  message?:     string
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ExtensionsStore {
  extensions:      Extension[]
  loading:         boolean
  installProgress: InstallProgress | null
  installError:    string | null
  loadErrors:      Record<string, string>

  loadExtensions:    () => Promise<void>
  installFromGitHub: (url: string) => Promise<{ success: boolean; error?: string }>
  uninstall:         (extensionId: string) => Promise<{ success: boolean; error?: string }>
  reload:            () => Promise<void>
  clearInstallState: () => void
}

export const useExtensionsStore = create<ExtensionsStore>((set, get) => ({
  extensions:      [],
  loading:         false,
  installProgress: null,
  installError:    null,
  loadErrors:      {},

  // ── Load list ──────────────────────────────────────────────────────────────

  async loadExtensions() {
    set({ loading: true })
    try {
      const list = await window.electron.extensions.list()
      set({ extensions: list, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  // ── Install from GitHub ────────────────────────────────────────────────────

  async installFromGitHub(url: string) {
    set({ installProgress: { step: 'downloading', percent: 0 }, installError: null })

    // Listen to granular progress events from main process
    window.electron.extensions.onInstallProgress((data) => {
      if (data.step === 'error') {
        set({ installProgress: null, installError: data.message ?? 'Unknown error' })
      } else {
        set({ installProgress: data })
      }
    })

    try {
      const result = await window.electron.extensions.installFromGitHub(url)

      if (result.success && result.extension) {
        // Merge the new extension into the list (or replace if already present)
        set((state) => {
          const filtered = state.extensions.filter((e) => e.id !== result.extensionId)
          return {
            extensions:      [...filtered, result.extension!],
            installProgress: { step: 'done', extensionId: result.extensionId },
            installError:    null,
          }
        })
      } else {
        set({ installProgress: null, installError: result.error ?? 'Installation failed' })
      }

      return result
    } catch (err) {
      const error = String(err)
      set({ installProgress: null, installError: error })
      return { success: false, error }
    } finally {
      window.electron.extensions.offInstallProgress()
    }
  },

  // ── Uninstall ──────────────────────────────────────────────────────────────

  async uninstall(extensionId: string) {
    const result = await window.electron.extensions.uninstall(extensionId)
    if (result.success) {
      set((state) => ({
        extensions: state.extensions.filter((e) => e.id !== extensionId),
      }))
    }
    return result
  },

  // ── Reload (rescan extensions dir + Python registry) ──────────────────────

  async reload() {
    const result = await window.electron.extensions.reload()
    if (result.success) {
      set({ loadErrors: result.errors ?? {} })
    }
    await get().loadExtensions()
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  clearInstallState() {
    set({ installProgress: null, installError: null })
  },
}))
