import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, ConfirmDialog } from '../components/ui'
import { downloadJson, stampedFilename } from '../lib/download'
import { MODE_DESCRIPTIONS, MODE_LABELS, shortDate } from '../lib/labels'
import {
  DEFAULT_CLOCK_TICK_SEC,
  progressStateSchema,
  type ProgressState,
  type SettingsState,
} from '../persistence/schema'
import { SCENARIOS } from '../scenarios'
import { useProgressStore } from '../store/progressStore'
import { useSettingsStore } from '../store/settingsStore'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[220px_1fr] sm:gap-4">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function RadioRow<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { id: T; label: string; hint?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.id}
          className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 ${value === o.id ? 'border-accent bg-accent-soft' : 'border-border hover:border-muted'}`}
          title={o.hint}
        >
          <input
            type="radio"
            name={name}
            value={o.id}
            checked={value === o.id}
            onChange={() => onChange(o.id)}
            className="accent-accent"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span>{label}</span>
    </label>
  )
}

export default function SettingsPage() {
  const s = useSettingsStore()
  const update = useSettingsStore((st) => st.update)
  const resetSettings = useSettingsStore((st) => st.reset)
  const settingsCorrupt = useSettingsStore((st) => st.corruptOnLoad)
  const progressCorrupt = useProgressStore((p) => p.corruptOnLoad)
  const lastSaveResult = useProgressStore((p) => p.lastSaveResult)
  const resetAll = useProgressStore((p) => p.resetAll)
  const exportState = useProgressStore((p) => p.export)
  const importState = useProgressStore((p) => p.importState)
  const clearScenario = useProgressStore((p) => p.clearScenario)
  const scenarioProgress = useProgressStore((p) => p.scenarios)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [pendingImport, setPendingImport] = useState<ProgressState | undefined>()
  const [importError, setImportError] = useState<string | undefined>()
  const [importOk, setImportOk] = useState(false)
  const [clearId, setClearId] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)
  const fontId = useId()
  const motionId = useId()
  const timerId = useId()
  const sysFontId = useId()
  const clockId = useId()

  const recorded = useMemo(
    () =>
      SCENARIOS.map((e) => e.summary).filter(
        (s) =>
          (scenarioProgress[s.id]?.attempts.length ?? 0) > 0 || scenarioProgress[s.id]?.inProgress,
      ),
    [scenarioProgress],
  )

  const onExport = () => downloadJson(stampedFilename('fcs-progress'), exportState())

  const onFile = (file: File | undefined) => {
    setImportError(undefined)
    setImportOk(false)
    if (!file) return
    file
      .text()
      .then((text) => {
        const parsed = progressStateSchema.safeParse(JSON.parse(text))
        if (!parsed.success) {
          setImportError(
            `형식이 올바르지 않습니다: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? ''}`,
          )
          return
        }
        setPendingImport(parsed.data)
      })
      .catch((e: unknown) =>
        setImportError(`파일을 읽을 수 없습니다: ${e instanceof Error ? e.message : String(e)}`),
      )
      .finally(() => {
        if (fileRef.current) fileRef.current.value = ''
      })
  }

  const set = <K extends keyof Omit<SettingsState, 'version'>>(key: K, value: SettingsState[K]) =>
    update({ [key]: value } as Partial<Omit<SettingsState, 'version'>>)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">설정</h1>
        <p className="text-muted">설정은 이 브라우저에 저장됩니다.</p>
      </header>

      {(progressCorrupt || settingsCorrupt) && (
        <p
          className="rounded-md border border-warning/40 bg-warning-bg p-2 text-sm text-warning"
          role="alert"
        >
          저장된{' '}
          {progressCorrupt && settingsCorrupt
            ? '진행 데이터와 설정'
            : progressCorrupt
              ? '진행 데이터'
              : '설정'}
          이(가) 손상되어 기본값으로 시작했습니다. 손상된 원본은{' '}
          <code className="font-mono">fcs:*.corrupt.*</code> 키로 백업되어 있습니다.
        </p>
      )}
      {lastSaveResult !== 'ok' && (
        <p
          className="rounded-md border border-critical/40 bg-critical-bg p-2 text-sm text-critical"
          role="alert"
        >
          {lastSaveResult === 'quota'
            ? '브라우저 저장 공간이 가득 차 진행 데이터를 저장하지 못했습니다. 진행 현황에서 JSON으로 내보낸 뒤 오래된 기록을 정리해 주세요.'
            : '브라우저 저장소를 사용할 수 없어 진행 데이터가 저장되지 않습니다 (사생활 보호 모드 등).'}
        </p>
      )}

      <section
        aria-labelledby="st-display"
        className="rounded-lg border border-border bg-surface px-4"
      >
        <h2 id="st-display" className="pt-3 text-base font-semibold">
          표시
        </h2>
        <Field label="테마">
          <RadioRow
            name="테마"
            value={s.theme}
            options={[
              { id: 'system', label: '시스템' },
              { id: 'light', label: '라이트' },
              { id: 'dark', label: '다크' },
            ]}
            onChange={(v) => set('theme', v)}
          />
        </Field>
        <Field label="용어 표기" hint="첫 등장 시 표기 순서">
          <RadioRow
            name="용어 표기"
            value={s.termDisplay}
            options={[
              { id: 'ko-en', label: '한글(English)' },
              { id: 'en-ko', label: 'English(한글)' },
            ]}
            onChange={(v) => set('termDisplay', v)}
          />
        </Field>
        <Field label="글자 크기" hint="0.85 ~ 1.3배">
          <div className="flex items-center gap-3">
            <input
              id={fontId}
              type="range"
              min={0.85}
              max={1.3}
              step={0.05}
              value={s.fontScale}
              onChange={(e) => set('fontScale', Number(e.target.value))}
              aria-label="글자 크기 배율"
              className="w-48 accent-accent"
            />
            <output htmlFor={fontId} className="num w-12">
              {s.fontScale.toFixed(2)}×
            </output>
            <Button size="sm" variant="ghost" onClick={() => set('fontScale', 1)}>
              기본
            </Button>
          </div>
        </Field>
        <Field label="시스템 글꼴 사용" hint="Pretendard 대신 운영체제 기본 글꼴">
          <Toggle
            id={sysFontId}
            checked={s.useSystemFont}
            onChange={(v) => set('useSystemFont', v)}
            label={s.useSystemFont ? '사용' : '사용 안 함'}
          />
        </Field>
        <Field label="모션 감소" hint="애니메이션·전환 효과 제거">
          <Toggle
            id={motionId}
            checked={s.reducedMotion}
            onChange={(v) => set('reducedMotion', v)}
            label={s.reducedMotion ? '켬' : '끔'}
          />
        </Field>
      </section>

      <section
        aria-labelledby="st-play"
        className="rounded-lg border border-border bg-surface px-4"
      >
        <h2 id="st-play" className="pt-3 text-base font-semibold">
          플레이
        </h2>
        <Field label="기본 모드" hint="브리핑에서 미리 선택되는 모드">
          <RadioRow
            name="기본 모드"
            value={s.defaultMode}
            options={(['guided', 'standard', 'expert'] as const).map((m) => ({
              id: m,
              label: MODE_LABELS[m],
              hint: MODE_DESCRIPTIONS[m].join(' · '),
            }))}
            onChange={(v) => set('defaultMode', v)}
          />
        </Field>
        <Field
          label="선택 근거 공개 시점"
          hint="'모드 기본'은 안내: 즉시 / 표준: 턴 종료 / 전문가: 시나리오 종료"
        >
          <RadioRow
            name="선택 근거 공개 시점"
            value={s.rationaleReveal}
            options={[
              { id: 'mode', label: '모드 기본' },
              { id: 'immediate', label: '즉시' },
              { id: 'endOfTurn', label: '턴 종료 시' },
              { id: 'endOfScenario', label: '시나리오 종료 시' },
            ]}
            onChange={(v) => set('rationaleReveal', v)}
          />
        </Field>
        <Field label="결정 타이머" hint="끄면 표준·전문가 모드에서도 시간 제한이 없습니다">
          <Toggle
            id={timerId}
            checked={s.timersEnabled}
            onChange={(v) => set('timersEnabled', v)}
            label={s.timersEnabled ? '켬' : '끔'}
          />
        </Field>
      </section>

      <section
        aria-labelledby="st-sim"
        className="rounded-lg border border-border bg-surface px-4"
      >
        <h2 id="st-sim" className="pt-3 text-base font-semibold">
          시뮬레이션
        </h2>
        <p className="pt-1 text-sm text-muted">
          일부 시나리오는 한 턴이 여러 시각(틱)으로 나뉘어 시계가 실제로 흐릅니다. 아래 설정은 그런
          턴에만 영향을 줍니다.
        </p>
        <Field
          label="시계 속도"
          hint="한 틱이 몇 초인지 (×1 기준). 짧을수록 시간 압박이 커집니다."
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={clockId}
              type="range"
              min={4}
              max={30}
              step={1}
              value={s.clockTickSec ?? DEFAULT_CLOCK_TICK_SEC}
              onChange={(e) => set('clockTickSec', Number(e.target.value))}
              aria-label="한 틱의 길이(초)"
              className="w-48 accent-accent"
            />
            <output htmlFor={clockId} className="num w-20">
              {s.clockTickSec !== undefined ? `${s.clockTickSec}초` : '모드 기본'}
            </output>
            <Button size="sm" variant="ghost" onClick={() => set('clockTickSec', undefined)}>
              모드 기본
            </Button>
            <span className="text-xs text-muted">
              모드 기본: 안내 30초 · 표준 20초 · 전문가 12초
            </span>
          </div>
        </Field>
        <Field
          label="변동성"
          hint="같은 선택도 매번 조금씩 다르게 전개됩니다. 0이면 완전히 동일 — 검증·재현용입니다."
        >
          <RadioRow
            name="변동성"
            value={String(s.variance ?? 1)}
            options={[
              { id: '0', label: '없음 (0)', hint: '같은 시드·같은 선택이면 항상 같은 결과' },
              { id: '0.5', label: '약간 (0.5)', hint: '유출·시세에 절반 크기의 흔들림' },
              { id: '1', label: '기본 (1)', hint: '실제 플레이 권장값' },
            ]}
            onChange={(v) => set('variance', Number(v) as 0 | 0.5 | 1)}
          />
        </Field>
      </section>

      <section
        aria-labelledby="st-data"
        className="rounded-lg border border-border bg-surface px-4 pb-3"
      >
        <h2 id="st-data" className="pt-3 text-base font-semibold">
          데이터
        </h2>
        {importError && (
          <p
            className="mt-2 rounded-md border border-critical/40 bg-critical-bg p-2 text-sm text-critical"
            role="alert"
          >
            {importError}
          </p>
        )}
        {importOk && (
          <p
            className="mt-2 rounded-md border border-positive/40 bg-positive-bg p-2 text-sm text-positive"
            role="status"
          >
            진행 데이터를 가져왔습니다. <Link to="/progress">진행 현황 보기</Link>
          </p>
        )}
        <Field label="진행 데이터 내보내기" hint="점수·시도 기록·열람 기록을 JSON 파일로">
          <Button variant="secondary" onClick={onExport}>
            내보내기 (JSON)
          </Button>
        </Field>
        <Field label="진행 데이터 가져오기" hint="현재 브라우저의 데이터를 파일 내용으로 대체">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              가져오기 (JSON)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="진행 데이터 파일 선택"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        </Field>
        <Field label="시나리오별 기록 삭제" hint="최고 점수·시도·진행 중 플레이·퀴즈 결과">
          {recorded.length === 0 ? (
            <p className="text-muted">아직 기록이 없습니다.</p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0">
              {recorded.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.title}</span>
                  <span className="num text-muted">
                    시도 {scenarioProgress[s.id]?.attempts.length ?? 0}회
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setClearId(s.id)}
                    aria-label={`${s.title} 기록 삭제`}
                  >
                    삭제
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="설정 초기화" hint="표시·플레이 설정을 기본값으로">
          <Button variant="secondary" onClick={resetSettings}>
            설정 기본값 복원
          </Button>
        </Field>
        <Field
          label="진행 데이터 초기화"
          hint="최고 점수, 시도 기록, 진행 중 플레이, 퀴즈, 열람 기록 삭제"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              진행 데이터 초기화…
            </Button>
            {resetDone && (
              <span className="text-positive" role="status">
                초기화되었습니다.
              </span>
            )}
          </div>
        </Field>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="진행 데이터를 모두 삭제할까요?"
        body={
          <div className="space-y-2">
            <p>
              이 브라우저에 저장된 모든 플레이 기록·퀴즈 결과·열람 기록이 삭제되며 되돌릴 수
              없습니다.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadJson(stampedFilename('fcs-progress'), exportState())}
            >
              먼저 내보내기 (JSON)
            </Button>
          </div>
        }
        confirmLabel="초기화"
        destructive
        typeToConfirm="초기화"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll()
          setConfirmReset(false)
          setResetDone(true)
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="진행 데이터를 가져올까요?"
        body={
          pendingImport ? (
            <>
              현재 브라우저의 진행 데이터가 파일 내용으로 <b>대체</b>됩니다. 파일: 시나리오{' '}
              {Object.keys(pendingImport.scenarios).length}개, 생성일{' '}
              {shortDate(pendingImport.meta.createdAt)}. 먼저 현재 데이터를 내보내 두는 것을
              권장합니다.
            </>
          ) : null
        }
        confirmLabel="가져오기"
        destructive
        onCancel={() => setPendingImport(undefined)}
        onConfirm={() => {
          if (pendingImport) {
            importState(pendingImport)
            setImportOk(true)
          }
          setPendingImport(undefined)
        }}
      />
      <ConfirmDialog
        open={Boolean(clearId)}
        title="이 시나리오의 기록을 삭제할까요?"
        body="최고 점수, 시도 기록, 진행 중인 플레이, 퀴즈 결과가 모두 삭제됩니다."
        confirmLabel="삭제"
        destructive
        onCancel={() => setClearId(undefined)}
        onConfirm={() => {
          if (clearId) clearScenario(clearId)
          setClearId(undefined)
        }}
      />
    </div>
  )
}
