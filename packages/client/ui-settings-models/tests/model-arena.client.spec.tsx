// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IApiClient, RpcResponse } from '@deepseek-ai/dsh-api-remotes/client'
import { ModelArena } from '../src/client/ModelArena.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const ok = <T,>(value: T): RpcResponse<T> => ({
  rpcId: 'arena-test' as never,
  result: { ok: true, value },
})

describe('ModelArena', () => {
  it('reuses candidate answers and calls only the synthesizer for the fused answer', async () => {
    let requestIndex = 0
    const arena = vi.fn<IApiClient['llm']['arena']>((payload) => {
      const index = requestIndex++
      return Promise.resolve(ok({
        results: payload.routes.map(route => ({
          ...route,
          text: `response-${index}`,
          latencyMs: 100 + index,
          inputTokens: 10,
          outputTokens: 20,
        })),
      }))
    })
    render(<ModelArena
      profiles={[{
        id: 'agnes-longcat-fusion',
        name: 'Agnes + LongCat 融合',
        candidates: [
          { provider: 'agnes-ai', model: 'agnes-2.5-flash' },
          { provider: 'longcat', model: 'LongCat-2.0' },
        ],
        synthesizer: { provider: 'longcat', model: 'LongCat-2.0' },
      }]}
      api={{ llm: { arena } }}
      t={key => en[key]}
    />)

    fireEvent.change(screen.getByLabelText('Test prompt'), { target: { value: '2 + 2?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run model comparison' }))
    await screen.findByText('response-0')

    expect(arena).toHaveBeenCalledTimes(3)
    expect(arena.mock.calls.map(([payload]) => payload.routes).flat()).toEqual([
      { provider: 'agnes-ai', model: 'agnes-2.5-flash' },
      { provider: 'longcat', model: 'LongCat-2.0' },
      { provider: 'longcat', model: 'LongCat-2.0' },
    ])
    expect(arena.mock.calls[2]?.[0].prompt).toContain('response-0')
    expect(arena.mock.calls[2]?.[0].prompt).toContain('response-1')
    expect(arena.mock.calls.slice(0, 2).every(([payload]) => payload.maxTokens === 512 && payload.timeoutMs === 30_000)).toBe(true)
    expect(arena.mock.calls[2]?.[0]).toMatchObject({ maxTokens: 768, timeoutMs: 20_000 })
    expect(screen.getByText('agnes-ai/agnes-2.5-flash')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose as best' })[0]!)

    await waitFor(() => { expect(screen.getByText('Accumulated wins')).toBeTruthy() })
    expect(screen.getAllByText(/\d+ ms ·/)).toHaveLength(3)
    expect(screen.getByText('Winner of this round')).toBeTruthy()
    expect(screen.getAllByText(/agnes-ai\/agnes-2.5-flash|longcat\/LongCat-2.0|fusion\/agnes-longcat-fusion/).length).toBeGreaterThan(0)
  })

  it('requires a configured fusion profile', () => {
    render(<ModelArena profiles={[]} api={{ llm: { arena: vi.fn() } }} t={key => en[key]} />)
    expect(screen.getByText('Create a fusion model before starting a comparison.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Run model comparison' })).toBeNull()
  })

  it('shows one anonymous slot per route and fills each slot as that route completes', async () => {
    const pending: Array<() => void> = []
    const arena = vi.fn<IApiClient['llm']['arena']>(payload => new Promise((resolve) => {
      const index = pending.length
      pending.push(() => { resolve(ok({
        results: [{ ...payload.routes[0]!, text: `response-${index}`, latencyMs: 10 }],
      })) })
    }))
    render(<ModelArena
      profiles={[{
        id: 'four-way-fusion',
        name: 'Four-way fusion',
        candidates: [
          { provider: 'p1', model: 'm1' },
          { provider: 'p2', model: 'm2' },
          { provider: 'p3', model: 'm3' },
          { provider: 'p4', model: 'm4' },
        ],
        synthesizer: { provider: 'p4', model: 'm4' },
      }]}
      api={{ llm: { arena } }}
      t={key => en[key]}
    />)

    expect(screen.getByText('Compared answers (5)')).toBeTruthy()
    expect(screen.getByText('Original model 1: p1/m1')).toBeTruthy()
    expect(screen.getByText('Original model 4: p4/m4')).toBeTruthy()
    expect(screen.getByText('Fused model: Four-way fusion')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Test prompt'), { target: { value: 'progressive prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run model comparison' }))

    expect(screen.getAllByText('Waiting for this model…')).toHaveLength(4)
    expect(screen.getByText('Waiting for candidate models before synthesis…')).toBeTruthy()
    expect(arena).toHaveBeenCalledTimes(4)
    expect(arena.mock.calls.every(([payload]) => payload.routes.length === 1)).toBe(true)

    pending[0]!()
    await screen.findByText('response-0')
    expect(screen.getAllByText('Waiting for this model…')).toHaveLength(3)

    pending[1]!()
    pending[2]!()
    pending[3]!()
    await waitFor(() => { expect(arena).toHaveBeenCalledTimes(5) })
    expect(screen.getByText('Candidate answers are ready; synthesizer is composing…')).toBeTruthy()
  })

  it('explains that a 404 arena transport requires restarting the local service', async () => {
    const arena = vi.fn<IApiClient['llm']['arena']>(() => Promise.reject(
      new Error('transport failure for /api/llm.arena: HTTP 404'),
    ))
    render(<ModelArena
      profiles={[{
        id: 'agnes-longcat-fusion',
        name: 'Agnes + LongCat fusion',
        candidates: [
          { provider: 'agnes-ai', model: 'agnes-2.5-flash' },
          { provider: 'longcat', model: 'LongCat-2.0' },
        ],
        synthesizer: { provider: 'longcat', model: 'LongCat-2.0' },
      }]}
      api={{ llm: { arena } }}
      t={key => en[key]}
    />)

    fireEvent.change(screen.getByLabelText('Test prompt'), { target: { value: '2 + 2?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run model comparison' }))

    expect(await screen.findByText('The arena backend is not ready. Restart the local service and try again.')).toBeTruthy()
  })
})
