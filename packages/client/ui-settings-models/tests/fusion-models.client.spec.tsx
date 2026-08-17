// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FusionModels } from '../src/client/FusionModels.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

describe('FusionModels vision consent', () => {
  it('reflects a global vision route that arrives after settings load', async () => {
    const props = {
      groups: [
        { id: 'agnes-ai', name: 'Agnes AI', models: [{ id: 'agnes-2.5-flash', name: 'Agnes 2.5 Flash', inputModalities: ['text', 'image'] }] },
      ] as never,
      writable: true,
      api: { settings: { mutate: vi.fn() }, llm: { arena: vi.fn() } } as never,
      controller: { load: vi.fn(() => Promise.resolve()) } as never,
      t: (key: keyof typeof en) => en[key],
    }
    const view = render(<FusionModels {...props} namespace={undefined} />)

    expect((screen.getByLabelText(en.globalVision) as HTMLSelectElement).value).toBe('')
    view.rerender(<FusionModels {...props} namespace={{
      ns: 'llm-fusion',
      value: {
        models: [],
        globalVisionProvider: 'agnes-ai',
        globalVisionModel: 'agnes-2.5-flash',
        shareImagesWithGlobalVisionProvider: true,
      },
      revision: 1,
    } as never} />)

    await waitFor(() => {
      expect((screen.getByLabelText(en.globalVision) as HTMLSelectElement).value).toBe('agnes-ai\u0000agnes-2.5-flash')
    })
    expect((screen.getByLabelText(en.globalVisionConsent) as HTMLInputElement).checked).toBe(true)
  })

  it('saves one acknowledged global vision fallback for ordinary text models', async () => {
    const mutate = vi.fn((_payload: unknown) => Promise.resolve({ rpcId: 'settings-global', result: { ok: true, value: {} } }))
    render(<FusionModels
      groups={[
        { id: 'longcat', name: 'LongCat', models: [{ id: 'LongCat-2.0', name: 'LongCat 2.0', inputModalities: ['text'] }] },
        { id: 'agnes-ai', name: 'Agnes AI', models: [{ id: 'agnes-2.5-flash', name: 'Agnes 2.5 Flash', inputModalities: ['text', 'image'] }] },
      ] as never}
      namespace={{ ns: 'llm-fusion', value: { models: [] }, revision: 7 } as never}
      writable
      api={{ settings: { mutate }, llm: { arena: vi.fn() } } as never}
      controller={{ load: vi.fn(() => Promise.resolve()) } as never}
      t={key => en[key]}
    />)

    fireEvent.change(screen.getByLabelText(en.globalVision), { target: { value: 'agnes-ai\u0000agnes-2.5-flash' } })
    expect((screen.getByRole('button', { name: en.globalVisionSave }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(en.globalVisionConsent))
    fireEvent.click(screen.getByRole('button', { name: en.globalVisionSave }))

    await waitFor(() => { expect(mutate).toHaveBeenCalledOnce() })
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      ns: 'llm-fusion',
      expectedRevision: 7,
      ops: [
        { op: 'set', path: ['globalVisionProvider'], value: 'agnes-ai' },
        { op: 'set', path: ['globalVisionModel'], value: 'agnes-2.5-flash' },
        { op: 'set', path: ['shareImagesWithGlobalVisionProvider'], value: true },
      ],
    })
  })

  it('blocks image routing until the user acknowledges external image sharing', async () => {
    const mutate = vi.fn((_payload: unknown) => Promise.resolve({
      rpcId: 'settings-1',
      result: { ok: true, value: {} },
    }))
    const load = vi.fn(() => Promise.resolve())
    const groups = [
      { id: 'alpha', name: 'Alpha', models: [{ id: 'text-a', name: 'Text A', inputModalities: ['text'] }] },
      { id: 'beta', name: 'Beta', models: [{ id: 'text-b', name: 'Text B', inputModalities: ['text'] }] },
      { id: 'eyes', name: 'Hosted Vision', models: [{ id: 'vision-v', name: 'Vision V', inputModalities: ['text', 'image'] }] },
    ]

    render(<FusionModels
      groups={groups as never}
      namespace={{ ns: 'llm-fusion', value: { models: [] }, revision: 4 } as never}
      writable
      api={{
        settings: { mutate },
        llm: { arena: vi.fn() },
      } as never}
      controller={{ load } as never}
      t={key => en[key]}
    />)

    fireEvent.click(screen.getByRole('button', { name: en.fusionAdd }))
    fireEvent.change(screen.getByLabelText(en.fusionId), { target: { value: 'with-eyes' } })
    fireEvent.change(screen.getByLabelText(en.fusionName), { target: { value: 'Fusion with eyes' } })
    fireEvent.click(screen.getByLabelText(/Text A/))
    fireEvent.click(screen.getByLabelText(/Text B/))
    fireEvent.change(screen.getByLabelText(/^Vision sidecar/), { target: { value: 'eyes\u0000vision-v' } })
    fireEvent.click(screen.getByRole('button', { name: en.apply }))

    expect(screen.getByText(en.fusionVisionConsentRequired)).toBeTruthy()
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText(en.fusionVisionConsent))
    fireEvent.click(screen.getByRole('button', { name: en.apply }))

    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      ns: 'llm-fusion',
      ops: [{
        op: 'set',
        path: ['models'],
        value: [expect.objectContaining({
          visionProvider: 'eyes',
          visionModel: 'vision-v',
          shareImagesWithVisionProvider: true,
        })],
      }],
    })
    await waitFor(() => { expect(load).toHaveBeenCalledTimes(1) })
  })
})
