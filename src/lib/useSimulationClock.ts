import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getTurnView, tickCount, type GameState, type ScenarioDefinition } from '../engine'
import { useGameStore, type ClockSpeed } from '../store/gameStore'

/** Real-time resolution of the accumulator. The engine never sees any of this. */
export const CLOCK_STEP_MS = 100

export interface SimulationClock {
  /** True only while the clock is actually moving (intent AND no hold). */
  running: boolean
  /** What the player asked for. A hold stops the clock without changing this. */
  intent: boolean
  /**
   * 0..1 through the current tick, as a subscribable store rather than a value.
   *
   * As state this re-rendered the entire play tree ten times a second for the length of a run —
   * every chart, the wire feed, the decision dock — to animate one dot. `useTickProgress(store)`
   * lets the single component that draws it subscribe, and leaves everyone else re-rendering on
   * events that actually happened.
   */
  progressStore: ProgressStore
  /** Current sub-turn tick and the turn's tick count. */
  tick: number
  ticks: number
  /** Why the clock is held right now (undefined = nothing holding it). */
  holdReason?: string
  /** True when the scenario has sub-turn ticks at all; false ⇒ render no clock affordance. */
  enabled: boolean
  speed: ClockSpeed
  toggle: () => void
  setSpeed: (speed: ClockSpeed) => void
}

export interface ClockOptions {
  /** Help sheet open: holds the clock in 안내·표준 (전문가 keeps running). */
  helpOpen?: boolean
  /** Turn intro card not dismissed yet — 이 턴의 과제를 읽는 동안 시계는 멈춘다. */
  introPending?: boolean
}

/**
 * Reasons the clock stops on its own, in the order they are reported. Each is a state the
 * player must act on; none of them flips the player's own `running` intent, so the clock
 * resumes by itself once the reason clears — but a manual pause is never undone automatically.
 */
function holdReasonFor(
  state: GameState,
  scenario: ScenarioDefinition,
  playedReelId: string | undefined,
  opts: ClockOptions & { mode: 'guided' | 'standard' | 'expert'; hidden: boolean },
): string | undefined {
  if (state.phase === 'ended') return '시나리오가 종료되었습니다'
  if (opts.introPending) return '턴 시작 대기 — 시계가 멈췄습니다'
  if (state.openInterrupts.length > 0) return '전화 응답 대기 — 시계가 멈췄습니다'
  const reel = state.lastReel
  // A turn-start reel is retired without being played (the situation panel already shows it).
  if (reel && reel.cause.kind !== 'turn' && reel.steps.length > 0 && reel.id !== playedReelId)
    return '결과 재생 중 — 시계가 멈췄습니다'

  let view
  try {
    view = getTurnView(state, scenario, { mode: opts.mode })
  } catch {
    return '턴 정보를 읽을 수 없습니다'
  }
  const unresolved = view.decisions.filter((d) => !d.resolved)
  // Only the deadline stops the day. An open decision must NOT hold the clock: the whole point of
  // the live clock is that the run-off keeps going while you deliberate, so deliberation has a
  // price. The player still cannot skip the decision — the turn will not advance until it is
  // answered, and a decision without a `deadlineTick` is caught by the last-tick hold below.
  if (unresolved.some((d) => d.decision.deadlineTick === state.tick))
    return '결정 마감 — 시계가 멈췄습니다'
  if (opts.helpOpen && opts.mode !== 'expert') return '도움말 열림 — 시계가 멈췄습니다'
  if (opts.hidden) return '화면이 비활성 상태입니다'
  if (state.tick >= tickCount(scenario.turns[state.turnIndex]) - 1)
    return '이 턴의 마지막 시각입니다 — 다음 턴으로 넘어가 주세요'
  return undefined
}

/**
 * A one-number external store. Deliberately not `useState`: the value changes ten times a second
 * and exactly one component cares.
 */
export interface ProgressStore {
  get: () => number
  set: (v: number) => void
  subscribe: (fn: () => void) => () => void
}

function createProgressStore(): ProgressStore {
  let value = 0
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (v: number) => {
      if (v === value) return
      value = v
      for (const fn of listeners) fn()
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

/** Subscribe to tick progress. The only caller is `TickDots`. */
export function useTickProgress(store: ProgressStore | undefined): number {
  const subscribe = store?.subscribe ?? noopSubscribe
  const get = store?.get ?? zero
  return useSyncExternalStore(subscribe, get, get)
}

const noopSubscribe = () => () => {}
const zero = () => 0

function documentHidden(): boolean {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'hidden'
}

/**
 * The live simulation clock. A 100 ms interval accumulates real time into `progress`
 * (0..1 of the current tick, scaled by `speed`); at 1 it calls `gameStore.tickAdvance()`.
 *
 * The clock never runs past the last tick of a turn — advancing the turn stays a deliberate
 * action — and it holds for an interrupt, a decision **at its deadline tick**, a reel that is
 * still playing, an open help sheet (guided/standard) or a hidden tab. It deliberately does not
 * hold for a decision that is merely open: time passing while you think is the point.
 * Everything is guarded for jsdom/SSR.
 */
export function useSimulationClock(opts: ClockOptions = {}): SimulationClock {
  const scenario = useGameStore((s) => s.scenario)
  const state = useGameStore((s) => s.state)
  const mode = useGameStore((s) => s.run?.mode ?? 'standard')
  const clock = useGameStore((s) => s.clock)
  const playedReelId = useGameStore((s) => s.playedReelId)
  const tickAdvance = useGameStore((s) => s.tickAdvance)
  const pause = useGameStore((s) => s.pause)
  const resume = useGameStore((s) => s.resume)
  const setStoreSpeed = useGameStore((s) => s.setSpeed)

  const [hidden, setHidden] = useState(documentHidden)
  /**
   * Tick progress lives outside React state.
   *
   * `setProgress` ten times a second re-rendered the whole play tree — the decision dock, the wire
   * feed, every Recharts chart on the dashboard tab — for thirty to fifty minutes, to move one
   * dot's opacity. The only component that reads it is `TickDots`. An external store means the
   * dot subscribes, everything else re-renders on the events that actually happened: a tick
   * advancing, a decision committing.
   */
  const storeRef = useRef<ProgressStore>(undefined as unknown as ProgressStore)
  if (!storeRef.current) storeRef.current = createProgressStore()
  const progressStore = storeRef.current
  const setProgress = progressStore.set

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => setHidden(documentHidden())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const ticks = state && scenario ? tickCount(scenario.turns[state.turnIndex]) : 1
  const enabled = ticks > 1

  const holdReason = useMemo(() => {
    if (!state || !scenario || !enabled) return undefined
    return holdReasonFor(state, scenario, playedReelId, {
      ...opts,
      mode,
      hidden,
    })
    // `opts` is a fresh object each render; its two flags are the only parts that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, scenario, playedReelId, mode, hidden, enabled, opts.helpOpen, opts.introPending])

  const running = enabled && clock.running && holdReason === undefined

  // The accumulator lives in a ref: only the rendered figure goes through state.
  const accRef = useRef(0)
  const tick = state?.tick ?? 0
  const turnIndex = state?.turnIndex ?? 0
  useEffect(() => {
    accRef.current = 0
    setProgress(0)
  }, [tick, turnIndex, running, setProgress])

  const tickAdvanceRef = useRef(tickAdvance)
  tickAdvanceRef.current = tickAdvance
  useEffect(() => {
    if (!running || typeof window === 'undefined') return
    const perTickMs = Math.max(CLOCK_STEP_MS, clock.baseTickMs / clock.speed)
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      accRef.current += (now - last) / perTickMs
      last = now
      if (accRef.current < 1) {
        setProgress(accRef.current)
        return
      }
      accRef.current = 0
      setProgress(0)
      tickAdvanceRef.current()
    }, CLOCK_STEP_MS)
    return () => window.clearInterval(id)
  }, [running, clock.baseTickMs, clock.speed, setProgress])

  const toggle = useCallback(() => {
    if (useGameStore.getState().clock.running) pause()
    else resume()
  }, [pause, resume])

  return {
    running,
    intent: clock.running,
    progressStore,
    tick,
    ticks,
    holdReason,
    enabled,
    speed: clock.speed,
    toggle,
    setSpeed: setStoreSpeed,
  }
}
