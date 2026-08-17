import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SettingsNavigationController } from '../src/client/settings-navigation.ts'

describe('SettingsNavigationController', () => {
  it('routes section requests to the mounted shell and ignores stale disposal', () => {
    const ctx = new Context()
    const navigation = new SettingsNavigationController(ctx)
    expect(() => { navigation.open('plugins') }).toThrow('Settings shell is not mounted')

    const first = vi.fn()
    const second = vi.fn()
    const disposeFirst = navigation.attach(first)
    navigation.open('plugins')
    expect(first).toHaveBeenCalledWith('plugins')

    const disposeSecond = navigation.attach(second)
    disposeFirst()
    navigation.open('general')
    expect(second).toHaveBeenCalledWith('general')

    disposeSecond()
    expect(() => { navigation.open('plugins') }).toThrow('Settings shell is not mounted')
  })
})
