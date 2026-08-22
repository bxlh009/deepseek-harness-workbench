/**
 * Desktop asar-mapping tests for the packaged-ripgrep resolution. When the
 * resolved platform-package path lives inside `<root>.asar` and its on-disk
 * mirror exists under `<root>.asar.unpacked`, resolution returns the mirrored
 * real path (a plain search child cannot read the asar virtual tree);
 * otherwise the original resolution passes through unchanged.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopUnpackedRgPath } from '../src/index.ts'

const cleanup: string[] = []

function makeAsarFixture(withMirror: boolean): { rgPath: string; unpackedRgPath: string } {
  const tmpParent = mkdtempSync(join(tmpdir(), 'dsh-rg-desktop-fixture-'))
  cleanup.push(tmpParent)
  const archiveRoot = join(tmpParent, 'app.asar')
  const unpackedRoot = `${archiveRoot}.unpacked`
  const virtualBinDir = join(archiveRoot, 'node_modules', '@vscode', 'ripgrep-win32-x64', 'bin')
  const diskBinDir = join(unpackedRoot, 'node_modules', '@vscode', 'ripgrep-win32-x64', 'bin')
  mkdirSync(virtualBinDir, { recursive: true })
  if (withMirror) {
    mkdirSync(diskBinDir, { recursive: true })
    writeFileSync(join(diskBinDir, 'rg.exe'), '')
  }
  return {
    rgPath: join(virtualBinDir, 'rg.exe'),
    unpackedRgPath: join(diskBinDir, 'rg.exe'),
  }
}

afterEach(() => {
  vi.resetModules()
  for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('desktopUnpackedRgPath', () => {
  it('returns the on-disk unpacked twin when the mirror exists', () => {
    const fixture = makeAsarFixture(true)
    expect(desktopUnpackedRgPath(fixture.rgPath)).toBe(fixture.unpackedRgPath)
  })

  it('returns undefined when no mirror exists and keeps non-asar paths unchanged', () => {
    const fixture = makeAsarFixture(false)
    expect(desktopUnpackedRgPath(fixture.rgPath)).toBeUndefined()
    expect(desktopUnpackedRgPath('C:\\Windows\\System32\\rg.exe')).toBeUndefined()
  })
})

describe('resolveRgPath inside a packaged desktop runtime', () => {
  it('resolves to the unpacked mirror when present', async () => {
    const fixture = makeAsarFixture(true)
    vi.doMock('@vscode/ripgrep', () => ({ rgPath: fixture.rgPath }))
    const { resolveRgPath: freshResolve } = await import('../src/index.ts')
    await expect(freshResolve()).resolves.toBe(fixture.unpackedRgPath)
  })

  it('keeps the asar resolution when no mirror exists (CLI/development layout)', async () => {
    const fixture = makeAsarFixture(false)
    vi.doMock('@vscode/ripgrep', () => ({ rgPath: fixture.rgPath }))
    const { resolveRgPath: freshResolve } = await import('../src/index.ts')
    await expect(freshResolve()).resolves.toBe(fixture.rgPath)
  })
})
