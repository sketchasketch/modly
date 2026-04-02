import { lazy } from 'react'
import type { Page } from '@shared/stores/navStore'

const GeneratePage   = lazy(() => import('@areas/generate/GeneratePage'))
const WorkflowsPage  = lazy(() => import('@areas/workflows/WorkflowsPage'))
const ModelsPage     = lazy(() => import('@areas/models/ModelsPage'))
const WorkspacePage  = lazy(() => import('@areas/workspace/WorkspacePage'))
const SettingsPage   = lazy(() => import('@areas/settings/SettingsPage'))

export interface RouteConfig {
  component:    React.ComponentType
  wrapperClass: string
}

export const ROUTES: Record<Page, RouteConfig> = {
  generate:  { component: GeneratePage,  wrapperClass: 'flex flex-1 overflow-hidden'   },
  workflows: { component: WorkflowsPage, wrapperClass: 'flex flex-1 overflow-hidden'   },
  models:    { component: ModelsPage,    wrapperClass: 'flex-1 overflow-y-auto'        },
  workspace: { component: WorkspacePage, wrapperClass: 'flex flex-1 overflow-hidden'   },
  settings:  { component: SettingsPage,  wrapperClass: 'flex-1 overflow-hidden'        },
}
