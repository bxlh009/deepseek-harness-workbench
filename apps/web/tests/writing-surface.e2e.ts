// Keyless browser acceptance for the product-level Writing surface. This boots
// the shipped composition so the assertion covers slot assembly, navigation,
// theme tokens, local persistence, and the real model catalog seam together.
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  captureStableAria, compareOrRefreshGolden, launchWebScaffold, watchConsole,
  webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/writing-surface', import.meta.url))
const WRITING_EXPECTED = join(SNAPSHOT_DIR, 'writing.expected.md')
const MODE = webSnapshotMode()

describe('web e2e: writing surface', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    const executablePath = process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH
    browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: 'zh-CN' })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('opens from the sidebar and keeps model choice explicit', async () => {
    onTestFailed(() => saveFailureShot(page, 'writing-surface'))
    await page.getByRole('button', { name: '写作', exact: true }).click()

    const writing = page.getByRole('main', { name: '写作工作台' })
    await writing.waitFor({ timeout: 10_000 })
    const model = writing.getByRole('combobox', { name: '选择模型' })
    await expect.poll(() => model.inputValue()).toBe('')
    expect(await writing.getByRole('button', { name: '生成预览' }).isDisabled()).toBe(true)
    expect(await writing.getAttribute('class')).toBeTruthy()

    const snapshot = await captureStableAria(page, 'main[aria-label="写作工作台"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(WRITING_EXPECTED, snapshot, MODE)

    const manuscript = writing.getByRole('textbox', { name: '正文' })
    await manuscript.fill('风暴逼近。旧灯熄灭。黎明到来。')
    await manuscript.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement
      textarea.focus()
      textarea.setSelectionRange(5, 10)
      textarea.dispatchEvent(new Event('select', { bubbles: true }))
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
    })
    await writing.getByText('已选 5 字').waitFor()
    await writing.getByRole('button', { name: '引用到助手' }).click()
    await expect.poll(() => writing.getByRole('textbox', { name: '给写作助手发消息' }).inputValue()).toContain('旧灯熄灭。')

    await writing.getByRole('button', { name: '记忆库' }).click()
    await writing.getByRole('button', { name: '人物', exact: true }).click()
    await writing.getByRole('button', { name: '新增人物' }).click()
    expect(await writing.getByRole('textbox', { name: '人物姓名' }).isVisible()).toBe(true)
    expect(await writing.getByText('本章 15 字').isVisible()).toBe(true)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})
