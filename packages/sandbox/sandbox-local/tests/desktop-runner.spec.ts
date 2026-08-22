/**
 * Desktop asar-mapping tests for the windows-acl runner invocation. The
 * mapping is pure path algebra over an on-disk fixture tree: a built entry
 * resolving inside `<root>.asar` swaps to the mirrored file under
 * `<root>.asar.unpacked` plus the bundled node.exe beside that root, and
 * falls back to undefined whenever the desktop layout is absent.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { desktopAclRunnerInvocation } from '../src/index.ts'

function makeDesktopFixture(): {
  tmpParent: string
  entry: string
  runnerEntry: string
  nodeExe: string
} {
  const tmpParent = mkdtempSync(join(tmpdir(), 'dsh-desktop-fixture-'))
  const archiveRoot = join(tmpParent, 'app.asar')
  const unpackedRoot = `${archiveRoot}.unpacked`
  const virtualLibDir = join(archiveRoot, 'node_modules', '@deepseek-ai', 'dsh-sandbox-windows-acl', 'lib')
  const diskLibDir = join(unpackedRoot, 'node_modules', '@deepseek-ai', 'dsh-sandbox-windows-acl', 'lib')
  mkdirSync(virtualLibDir, { recursive: true })
  mkdirSync(diskLibDir, { recursive: true })
  writeFileSync(join(diskLibDir, 'runner.js'), '// on-disk mirror\n')
  writeFileSync(join(unpackedRoot, 'node.exe'), '')
  return {
    tmpParent,
    entry: join(virtualLibDir, 'runner.js'),
    runnerEntry: join(diskLibDir, 'runner.js'),
    nodeExe: join(unpackedRoot, 'node.exe'),
  }
}

describe('desktopAclRunnerInvocation', () => {
  it('maps an archived entry onto the unpacked mirror and the bundled node.exe', () => {
    const fixture = makeDesktopFixture()
    try {
      expect(desktopAclRunnerInvocation(fixture.entry)).toEqual([
        fixture.nodeExe,
        fixture.runnerEntry,
      ])
    } finally {
      rmSync(fixture.tmpParent, { recursive: true, force: true })
    }
  })

  it('returns undefined when the unpacked mirror is absent', () => {
    const archiveRoot = join(mkdtempSync(join(tmpdir(), 'dsh-desktop-fixture-')), 'app.asar')
    try {
      const entry = join(archiveRoot, 'node_modules', '@deepseek-ai', 'dsh-sandbox-windows-acl', 'lib', 'runner.js')
      mkdirSync(join(archiveRoot, 'node_modules', '@deepseek-ai', 'dsh-sandbox-windows-acl', 'lib'), { recursive: true })
      expect(desktopAclRunnerInvocation(entry)).toBeUndefined()
    } finally {
      rmSync(archiveRoot, { recursive: true, force: true })
    }
  })

  it('returns undefined for entries outside any asar archive', () => {
    const plain = join(mkdtempSync(join(tmpdir(), 'dsh-desktop-fixture-')), 'runner.js')
    try {
      writeFileSync(plain, '// plain disk file\n')
      expect(desktopAclRunnerInvocation(plain)).toBeUndefined()
    } finally {
      rmSync(plain, { force: true })
    }
  })
})
