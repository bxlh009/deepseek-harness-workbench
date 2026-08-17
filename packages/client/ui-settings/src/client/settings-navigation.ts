import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'

type OpenSettingsSection = (sectionId: string) => void

declare module '@deepseek-ai/cordis' {
  interface Context {
    settingsNavigation: SettingsNavigationController
  }
}

/**
 * Cross-plugin doorway into the settings shell. The shell owns modal state;
 * callers only request a section by its stable id.
 */
export class SettingsNavigationController extends Service {
  private handler: OpenSettingsSection | undefined

  constructor(ctx: Context) {
    super(ctx, 'settingsNavigation')
  }

  /** Attach the currently mounted settings shell. */
  attach(handler: OpenSettingsSection): () => void {
    this.handler = handler
    return () => {
      if (this.handler === handler) this.handler = undefined
    }
  }

  /** Open an implemented settings section, failing loudly if no shell exists. */
  open(sectionId: string): void {
    if (this.handler === undefined) {
      throw new Error('Settings shell is not mounted')
    }
    this.handler(sectionId)
  }
}
