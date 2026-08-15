/**
 * Global theme DOM applier: projects the resolved ThemeSnapshot onto the
 * document — `html { color-scheme }` for native UA chrome (scrollbars, form
 * controls), body attributes for the dark palette and visual skin, the active
 * theme's alias-token overrides as inline CSS variables on body, and one
 * presenter-owned `meta[name="theme-color"]` for surrounding browser UI. Pure
 * DOM writes, no React involvement; the presenter only ever retracts what it
 * wrote itself, so foreign attributes, metadata, and inline styles survive.
 */
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Body attribute selecting the dark base palette in the token stylesheets. */
export const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/** Body attribute selecting the visual skin in the token stylesheets. */
export const SKIN_ATTRIBUTE = 'data-ds-skin'

/** Host bootstrap token names waiting for the client presenter to retract. */
export const BOOTSTRAP_TOKENS_ATTRIBUTE = 'data-ds-theme-bootstrap-tokens'

/** Host bootstrap marker for the presenter-owned custom background layer. */
export const BOOTSTRAP_BACKGROUND_ATTRIBUTE = 'data-ds-theme-bootstrap-background'

/** Applies theme snapshots to the document; one instance per plugin fiber. */
export class ThemePresenter {
  /** Token names this presenter wrote in the last apply (its retraction set). */
  private appliedTokens: string[] = []
  /** The single metadata node this presenter inserts and removes. */
  private readonly themeColorMeta: HTMLMetaElement
  /** Inline background properties that existed before this presenter took ownership. */
  private readonly initialBackground: Readonly<{
    image: string
    size: string
    position: string
    attachment: string
    customImage: string
  }>

  /** Create the presenter-owned metadata node before the first snapshot arrives. */
  constructor() {
    // Host bootstrap owns these variables during the pre-plugin interval and
    // leaves their names in a DOM marker. Seed the retraction set so the first
    // client apply can replace bootstrap values without a cross-plugin import.
    const bootstrapTokens = document.body.getAttribute(BOOTSTRAP_TOKENS_ATTRIBUTE)
    this.appliedTokens = bootstrapTokens === null
      ? []
      : [...new Set(bootstrapTokens.split(' ').filter(Boolean))]
    document.body.removeAttribute(BOOTSTRAP_TOKENS_ATTRIBUTE)
    const fromBootstrap = document.body.hasAttribute(BOOTSTRAP_BACKGROUND_ATTRIBUTE)
    this.initialBackground = Object.freeze({
      image: fromBootstrap ? '' : document.body.style.backgroundImage,
      size: fromBootstrap ? '' : document.body.style.backgroundSize,
      position: fromBootstrap ? '' : document.body.style.backgroundPosition,
      attachment: fromBootstrap ? '' : document.body.style.backgroundAttachment,
      customImage: fromBootstrap ? '' : document.body.style.getPropertyValue('--dsh-custom-skin-image'),
    })
    document.body.removeAttribute(BOOTSTRAP_BACKGROUND_ATTRIBUTE)
    this.themeColorMeta = document.createElement('meta')
    this.themeColorMeta.name = 'theme-color'
  }

  /**
   * Project a snapshot onto the document: set root `color-scheme` and the body
   * palette attribute from `active.colorScheme` (never the id — `system` is
   * resolved upstream), set the independent skin attribute, then replace the
   * previously applied token variables with `active.tokens`. Browser
   * theme-color metadata follows the computed body background after those
   * writes, so the rendered palette remains the color authority.
   * @param snapshot - resolved theme snapshot from ctx.theme.
   */
  apply(snapshot: ThemeSnapshot): void {
    const scheme = snapshot.active.colorScheme
    document.documentElement.style.colorScheme = scheme
    const body = document.body
    if (scheme === 'dark') body.setAttribute(DARK_ATTRIBUTE, '')
    else body.removeAttribute(DARK_ATTRIBUTE)
    body.setAttribute(SKIN_ATTRIBUTE, snapshot.skin)
    body.removeAttribute(BOOTSTRAP_TOKENS_ATTRIBUTE)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      body.style.setProperty(name, value)
      this.appliedTokens.push(name)
    }
    this.applyBackground(body, snapshot.backgroundImage, scheme)
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta)
  }

  /** Retract root color-scheme, palette attributes, token variables, and owned metadata. */
  dispose(): void {
    document.documentElement.style.removeProperty('color-scheme')
    const body = document.body
    body.removeAttribute(DARK_ATTRIBUTE)
    body.removeAttribute(SKIN_ATTRIBUTE)
    body.removeAttribute(BOOTSTRAP_TOKENS_ATTRIBUTE)
    body.removeAttribute(BOOTSTRAP_BACKGROUND_ATTRIBUTE)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    this.restoreBackground(body)
    this.themeColorMeta.remove()
  }

  private applyBackground(body: HTMLElement, image: string | undefined, scheme: 'light' | 'dark'): void {
    body.removeAttribute(BOOTSTRAP_BACKGROUND_ATTRIBUTE)
    if (image === undefined) {
      this.restoreBackground(body)
      return
    }
    body.style.setProperty('--dsh-custom-skin-image', `url("${image}")`)
    const overlay = scheme === 'dark'
      ? 'linear-gradient(rgba(6, 10, 18, 0.30), rgba(6, 10, 18, 0.50))'
      : 'linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.28))'
    body.style.backgroundImage = `${overlay}, url("${image}")`
    body.style.backgroundSize = 'cover'
    body.style.backgroundPosition = 'center'
    body.style.backgroundAttachment = 'fixed'
  }

  private restoreBackground(body: HTMLElement): void {
    body.style.backgroundImage = this.initialBackground.image
    body.style.backgroundSize = this.initialBackground.size
    body.style.backgroundPosition = this.initialBackground.position
    body.style.backgroundAttachment = this.initialBackground.attachment
    if (this.initialBackground.customImage === '') {
      body.style.removeProperty('--dsh-custom-skin-image')
    } else {
      body.style.setProperty('--dsh-custom-skin-image', this.initialBackground.customImage)
    }
  }
}
