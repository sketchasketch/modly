import type { ModelExtension, ProcessExtension, ExtensionVariant } from '@shared/stores/extensionsStore'

// ─── UI types (used by WorkflowsPage) ────────────────────────────────────────

export type { ParamSchema } from '@shared/types/electron.d'
import type { ParamSchema } from '@shared/types/electron.d'

export interface WorkflowExtension {
  id:          string
  name:        string
  description: string
  input:       'image' | 'text' | 'mesh'
  output:      'image' | 'text' | 'mesh'
  params:      ParamSchema[]
  builtin:     boolean
}

// ─── Converters ───────────────────────────────────────────────────────────────

export function processExtensionToWorkflow(ext: ProcessExtension): WorkflowExtension {
  return {
    id:          ext.id,
    name:        ext.name,
    description: ext.description ?? '',
    input:       ext.input,
    output:      ext.output,
    params:      ext.paramsSchema as ParamSchema[],
    builtin:     ext.builtin,
  }
}

export function modelVariantToWorkflow(ext: ModelExtension, variant: ExtensionVariant): WorkflowExtension {
  return {
    id:          variant.id,
    name:        variant.name,
    description: variant.description ?? ext.description ?? '',
    input:       'image',
    output:      'mesh',
    params:      ext.paramsSchema ?? [],
    builtin:     ext.builtin,
  }
}

export function buildAllWorkflowExtensions(
  modelExtensions:   ModelExtension[],
  processExtensions: ProcessExtension[],
): WorkflowExtension[] {
  return [
    ...processExtensions.map(processExtensionToWorkflow),
    ...modelExtensions.flatMap((ext) => ext.models.map((v) => modelVariantToWorkflow(ext, v))),
  ]
}

export function getWorkflowExtension(id: string, all: WorkflowExtension[]): WorkflowExtension | undefined {
  return all.find((e) => e.id === id)
}
