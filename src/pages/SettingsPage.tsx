import { useId, useState, type ReactNode } from 'react'
import { Button, ConfirmDialog } from '../components/ui'
import { downloadJson, stampedFilename } from '../lib/download'
import { MODE_DESCRIPTIONS, MODE_LABELS } from '../lib/labels'
import type { SettingsState } from '../persistence/schema'
import { useProgressStore } from '../store/progressStore'
import { useSettingsStore } from '../store/settingsStore'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[220px_1fr] sm:gap-4">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
      <div className="text-[12px]">{children}</div>
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
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const fontId = useId()
  const motionId = useId()
  const timerId = useId()
  const sysFontId = useId()

  const set = <K extends keyof Omit<SettingsState, 'version'>>(key: K, value: SettingsState[K]) =>
    update({ [key]: value } as Partial<Omit<SettingsState, 'version'>>)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">설정</h1>
        <p className="text-muted">설정은 이 브라우저에 저장됩니다.</p>
      </header>

      {(progressCorrupt || settingsCorrupt) && (
        <p
          className="rounded-md border border-warning/40 bg-warning-bg p-2 text-[12px] text-warning"
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
          className="rounded-md border border-critical/40 bg-critical-bg p-2 text-[12px] text-critical"
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
        <h2 id="st-display" className="pt-3 text-[14px] font-semibold">
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
        <h2 id="st-play" className="pt-3 text-[14px] font-semibold">
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
        aria-labelledby="st-data"
        className="rounded-lg border border-border bg-surface px-4 pb-3"
      >
        <h2 id="st-data" className="pt-3 text-[14px] font-semibold">
          데이터
        </h2>
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
    </div>
  )
}
