import { describe, expect, it } from 'vitest'
import { resolveDialogNodeCommand } from '../src/win32-dialog-host.ts'

describe('resolveDialogNodeCommand', () => {
  it('uses the packaged Node runtime when the Host is carried by Electron', () => {
    expect(resolveDialogNodeCommand({ DSH_NODE_RUNTIME: 'C:\\app\\resources\\runtime.asar.unpacked\\node.exe' }, 'C:\\app\\Workbench.exe'))
      .toBe('C:\\app\\resources\\runtime.asar.unpacked\\node.exe')
  })

  it('falls back to the current executable for source and test hosts', () => {
    expect(resolveDialogNodeCommand({}, 'node')).toBe('node')
    expect(resolveDialogNodeCommand({ DSH_NODE_RUNTIME: '   ' }, 'electron')).toBe('electron')
  })
})
