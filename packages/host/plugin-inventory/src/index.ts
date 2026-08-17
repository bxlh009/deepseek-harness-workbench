/** Read-only projection of the current Cordis Loader plugin entries. */

import type { Context, FiberState } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  PluginEntryId,
  PluginFiberPhase,
  PluginInventoryEntry,
  PluginInventorySnapshot,
} from './types.ts'

export type * from './types.ts'

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

/** Runtime spine modules that must remain mounted so the user can manage the app. */
const PROTECTED_MODULE_MARKERS = [
  'cordis:include',
  'cordis:group',
  'dsh-api-gateway',
  'dsh-api-remotes',
  'dsh-client-connection',
  'dsh-client-modules',
  'dsh-client-runtime',
  'dsh-client-web',
  'dsh-client-ui-conversation',
  'dsh-client-ui-layout',
  'dsh-client-ui-settings',
  'dsh-client-ui-sidebar',
  'dsh-host-apiproxy',
  'dsh-host-frontend-static',
  'dsh-host-plugin-inventory',
  'dsh-host-webserver',
  'dsh-typert-loader',
  'dsh-typert-registry',
] as const

function isProtectedModule(moduleName: string): boolean {
  return PROTECTED_MODULE_MARKERS.some(marker => moduleName.includes(marker))
}

/** Remote-only service exposing the Loader's current non-group entry state. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  constructor(ctx: Context) {
    super(ctx, 'pluginInventory')
  }

  /**
   * Read the Loader directly on every call. Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   * @returns Current non-group Loader entries in Loader order.
   */
  @Remote('list')
  list(): PluginInventorySnapshot {
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      entries.push({
        entryId: pluginEntryId(entry.id),
        moduleName: entry.options.name,
        enabled: !entry.disabled,
        toggleable: !isProtectedModule(entry.options.name),
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      })
    }
    return { entries }
  }

  /** Persist one optional Loader entry's disabled flag and mount or dispose it. */
  @Remote('setEnabled')
  async setEnabled(entryId: PluginEntryId, enabled: boolean): Promise<PluginInventorySnapshot> {
    const entry = this.ctx.loader.resolve(entryId)
    if (entry.options.group) throw new Error(`cannot toggle group entry ${entryId}`)
    if (isProtectedModule(entry.options.name)) {
      throw new Error(`cannot toggle protected core plugin ${entry.options.name}`)
    }
    await this.ctx.loader.update(entryId, { disabled: enabled ? null : true })
    return this.list()
  }
}

export default PluginInventoryGateway
