import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  IApiClient, LlmArenaResult, LlmArenaRoute,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

interface FusionProfile {
  id: string
  name: string
  candidates: LlmArenaRoute[]
  synthesizer: LlmArenaRoute
}

interface Props {
  profiles: readonly FusionProfile[]
  api: { llm: Pick<IApiClient['llm'], 'arena'> }
  t: (key: keyof typeof en) => string
}

interface Score {
  route: LlmArenaRoute
  wins: number
}

interface ArenaSlot {
  route: LlmArenaRoute
  result?: LlmArenaResult
}

const routeKey = (route: LlmArenaRoute): string => `${route.provider}\u0000${route.model}`
const routeLabel = (route: LlmArenaRoute): string => `${route.provider}/${route.model}`

function synthesisPrompt(prompt: string, answers: readonly LlmArenaResult[]): string {
  const header = [
    'You are the final synthesizer of a multi-model comparison.',
    'Use the drafts as fallible evidence: reconcile conflicts, correct errors, and answer the original question directly.',
    'Do not mention the comparison process unless the user asks.',
    `Original question:\n${prompt}`,
    'Candidate drafts:',
  ].join('\n\n')
  let remaining = Math.max(0, 15_500 - header.length)
  const drafts = answers.map((answer, index) => {
    const label = `### Candidate ${index + 1} (${routeLabel(answer)})\n`
    const text = answer.text.slice(0, Math.max(0, remaining - label.length))
    remaining -= label.length + text.length
    return `${label}${text}`
  })
  return `${header}\n\n${drafts.join('\n\n')}`.slice(0, 16_000)
}

function anonymize<T>(results: readonly T[], prompt: string): T[] {
  let seed = 0
  for (const character of prompt) seed = ((seed * 31) + (character.codePointAt(0) ?? 0)) >>> 0
  const shuffled = [...results]
  for (let index = shuffled.length - 1; index > 0; index--) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    const target = seed % (index + 1)
    const held = shuffled[index] as T
    shuffled[index] = shuffled[target] as T
    shuffled[target] = held
  }
  return shuffled
}

/** Blind, user-judged comparison for a configured fusion profile and its candidates. */
export function ModelArena({ profiles, api, t }: Props): ReactNode {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [slots, setSlots] = useState<readonly ArenaSlot[]>([])
  const [revealed, setRevealed] = useState(false)
  const [winner, setWinner] = useState<string | undefined>(undefined)
  const [scores, setScores] = useState<ReadonlyMap<string, Score>>(() => new Map())
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [fusionPhase, setFusionPhase] = useState<'candidates' | 'synthesizing'>('candidates')
  const profile = profiles.find(candidate => candidate.id === profileId) ?? profiles[0]
  const routes = useMemo(() => profile === undefined
    ? []
    : [...profile.candidates, { provider: 'fusion', model: profile.id }], [profile])

  const run = (): void => {
    if (profile === undefined || prompt.trim() === '' || running) return
    setRunning(true)
    setFailure(undefined)
    const roundPrompt = prompt.trim()
    const anonymousRoutes = anonymize(routes, roundPrompt)
    setSlots(anonymousRoutes.map(route => ({ route })))
    setWinner(undefined)
    setRevealed(false)
    setFusionPhase('candidates')
    let remaining = anonymousRoutes.length
    const settle = (route: LlmArenaRoute, result: LlmArenaResult): void => {
      setSlots(current => current.map(slot => routeKey(slot.route) === routeKey(route)
        ? { ...slot, result }
        : slot))
      remaining -= 1
      if (remaining === 0) setRunning(false)
    }
    const fusionRoute = { provider: 'fusion', model: profile.id }
    const started = Date.now()
    const candidateRuns = profile.candidates.map(async (route): Promise<LlmArenaResult> => {
      try {
        const response = await api.llm.arena({ prompt: roundPrompt, routes: [route], maxTokens: 512, timeoutMs: 30_000 })
        if (!response.result.ok) {
          const result = { ...route, text: '', latencyMs: 0, error: response.result.error.message }
          settle(route, result)
          return result
        }
        const result = response.result.value.results[0]
          ?? { ...route, text: '', latencyMs: 0, error: 'Model returned no arena result.' }
        settle(route, result)
        return result
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        setFailure(message.includes('/api/llm.arena') && message.includes('HTTP 404')
          ? t('arenaUnavailable')
          : message)
        const result = { ...route, text: '', latencyMs: 0, error: message }
        settle(route, result)
        return result
      }
    })
    void Promise.all(candidateRuns).then(async (answers) => {
      const usable = answers.filter(answer => answer.error === undefined && answer.text.trim() !== '')
      if (usable.length === 0) {
        settle(fusionRoute, { ...fusionRoute, text: '', latencyMs: Date.now() - started, error: 'All candidate models failed.' })
        return
      }
      try {
        setFusionPhase('synthesizing')
        const response = await api.llm.arena({
          prompt: synthesisPrompt(roundPrompt, usable), routes: [profile.synthesizer], maxTokens: 768, timeoutMs: 20_000,
        })
        if (!response.result.ok) {
          settle(fusionRoute, { ...fusionRoute, text: '', latencyMs: Date.now() - started, error: response.result.error.message })
          return
        }
        const answer = response.result.value.results[0]
        settle(fusionRoute, answer === undefined
          ? { ...fusionRoute, text: '', latencyMs: Date.now() - started, error: 'Synthesizer returned no arena result.' }
          : {
            ...answer,
            ...fusionRoute,
            latencyMs: Date.now() - started,
            inputTokens: usable.reduce((total, item) => total + (item.inputTokens ?? 0), answer.inputTokens ?? 0),
            outputTokens: usable.reduce((total, item) => total + (item.outputTokens ?? 0), answer.outputTokens ?? 0),
          })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        settle(fusionRoute, { ...fusionRoute, text: '', latencyMs: Date.now() - started, error: message })
      }
    })
  }

  const vote = (answer: LlmArenaResult): void => {
    if (revealed || answer.error !== undefined) return
    const key = routeKey(answer)
    setWinner(key)
    setRevealed(true)
    setScores((previous) => {
      const next = new Map(previous)
      const current = next.get(key)
      next.set(key, { route: answer, wins: (current?.wins ?? 0) + 1 })
      return next
    })
  }

  return (
    <section className={styles['arenaSection']} aria-labelledby="model-arena-title">
      <div>
        <h3 id="model-arena-title" className={styles['fusionTitle']}>{t('arenaTitle')}</h3>
        <p className={styles['intro']}>{t('arenaIntro')}</p>
      </div>
      {profile === undefined
        ? <p className={styles['notice']}>{t('arenaNeedsFusion')}</p>
        : (
          <div className={styles['arenaControls']}>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('arenaProfile')}</span>
              <select className={`${styles['input']} ${styles['selectInput']}`} value={profile.id} onChange={(event) => { setProfileId(event.target.value) }}>
                {profiles.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
            </label>
            <div className={styles['arenaParticipants']}>
              <strong>{`${t('arenaCompared')} (${routes.length})`}</strong>
              {profile.candidates.map((route, index) => (
                <span key={routeKey(route)}>{`${t('arenaOriginalModel')} ${index + 1}: ${routeLabel(route)}`}</span>
              ))}
              <span>{`${t('arenaFusedModel')}: ${profile.name}`}</span>
            </div>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('arenaPrompt')}</span>
              <textarea className={styles['arenaPrompt']} value={prompt} maxLength={16_000} onChange={(event) => { setPrompt(event.target.value) }} placeholder={t('arenaPromptPlaceholder')} />
            </label>
            <button type="button" className={styles['primaryButton']} disabled={running || prompt.trim() === ''} onClick={run}>
              {running ? t('arenaRunning') : t('arenaRun')}
            </button>
          </div>
        )}
      {failure === undefined ? null : <p className={styles['error']}>{failure}</p>}
      {slots.length === 0 ? null : (
        <div className={styles['arenaAnswers']}>
          {slots.map((slot, index) => {
            const answer = slot.result
            const key = routeKey(slot.route)
            return (
              <article key={key} className={styles['arenaAnswer']}>
                <div className={styles['arenaAnswerHead']}>
                  <strong>{`${t('arenaAnswer')} ${String.fromCharCode(65 + index)}`}</strong>
                  <span className={styles['fusionRoute']}>{routeLabel(slot.route)}</span>
                </div>
                {answer === undefined
                  ? <p className={styles['arenaText']}>{slot.route.provider === 'fusion'
                    ? t(fusionPhase === 'candidates' ? 'arenaFusionPending' : 'arenaSynthesizing')
                    : t('arenaPending')}</p>
                  : answer.error === undefined
                    ? <p className={styles['arenaText']}>{answer.text}</p>
                    : <p className={styles['error']}>{answer.error}</p>}
                {answer === undefined
                  ? null
                  : revealed
                    ? <p className={styles['arenaMetrics']}>{`${answer.latencyMs} ms · ${answer.inputTokens ?? '?'} + ${answer.outputTokens ?? '?'} token`}</p>
                    : (
                      <button type="button" className={styles['secondaryButton']} disabled={running || answer.error !== undefined} onClick={() => { vote(answer) }}>
                        {t('arenaChoose')}
                      </button>
                    )}
                {revealed && winner === key ? <span className={styles['arenaWinner']}>{t('arenaWinner')}</span> : null}
              </article>
            )
          })}
        </div>
      )}
      {!revealed || scores.size === 0 ? null : (
        <div className={styles['arenaScore']}>
          <strong>{t('arenaScore')}</strong>
          {[...scores.values()].sort((left, right) => right.wins - left.wins).map(score => (
            <span key={routeKey(score.route)}>{`${routeLabel(score.route)}：${score.wins}`}</span>
          ))}
        </div>
      )}
    </section>
  )
}
