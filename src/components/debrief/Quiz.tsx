import { useEffect, useId, useState } from 'react'
import type { QuizQuestion, Source } from '../../engine/types'
import type { ScenarioProgress } from '../../persistence/schema'
import { formatNumber } from '../../lib/format'
import { shortDate } from '../../lib/labels'
import { useProgressStore } from '../../store/progressStore'
import { Citation } from '../knowledge/Citation'
import { Badge, Button, Card } from '../ui'

type Answer = string[] | number | boolean

function isCorrect(q: QuizQuestion, a: Answer | undefined): boolean {
  if (a === undefined) return false
  switch (q.type) {
    case 'single':
    case 'multi': {
      if (!Array.isArray(a)) return false
      const want = new Set(q.answer)
      return a.length === want.size && a.every((x) => want.has(x))
    }
    case 'numeric':
      return typeof a === 'number' && Number.isFinite(a) && Math.abs(a - q.answer) <= q.tolerance
    case 'true_false':
      return typeof a === 'boolean' && a === q.answer
  }
}

function answerText(q: QuizQuestion): string {
  switch (q.type) {
    case 'single':
    case 'multi':
      return q.answer.map((id) => q.choices.find((c) => c.id === id)?.text ?? id).join(', ')
    case 'numeric':
      return `${formatNumber(q.answer, Number.isInteger(q.answer) ? 0 : 2)}${q.unit} (허용 오차 ±${formatNumber(q.tolerance, Number.isInteger(q.tolerance) ? 0 : 2)})`
    case 'true_false':
      return q.answer ? '참(O)' : '거짓(X)'
  }
}

function QuestionCard({
  index,
  q,
  answer,
  submitted,
  onAnswer,
  onSubmit,
  localSources,
}: {
  index: number
  q: QuizQuestion
  answer: Answer | undefined
  submitted: boolean
  onAnswer: (a: Answer) => void
  onSubmit: () => void
  localSources: Source[]
}) {
  const groupId = useId()
  const correct = submitted && isCorrect(q, answer)
  const answered =
    answer !== undefined &&
    !(Array.isArray(answer) && answer.length === 0) &&
    !(typeof answer === 'number' && Number.isNaN(answer))
  return (
    <Card as="li" className="p-3">
      <fieldset className="m-0 border-0 p-0" disabled={submitted}>
        <legend className="text-base font-medium">
          <span className="num text-muted">Q{index + 1}.</span> {q.prompt}
          {q.type === 'multi' && <span className="text-muted text-xs"> (복수 선택)</span>}
        </legend>
        <div className="mt-2 space-y-1 text-sm">
          {(q.type === 'single' || q.type === 'multi') &&
            q.choices.map((c) => {
              const arr = Array.isArray(answer) ? answer : []
              const on = arr.includes(c.id)
              return (
                <label
                  key={c.id}
                  className="flex items-start gap-2 rounded-sm px-1 py-0.5 hover:bg-surface-2"
                >
                  <input
                    type={q.type === 'single' ? 'radio' : 'checkbox'}
                    name={groupId}
                    value={c.id}
                    checked={on}
                    onChange={() => {
                      if (q.type === 'single') onAnswer([c.id])
                      else onAnswer(on ? arr.filter((x) => x !== c.id) : [...arr, c.id])
                    }}
                    className="mt-0.5 accent-accent"
                  />
                  <span>{c.text}</span>
                  {submitted && q.answer.includes(c.id) && (
                    <Badge tone="positive" className="ml-auto shrink-0">
                      정답
                    </Badge>
                  )}
                </label>
              )
            })}
          {q.type === 'numeric' && (
            <label className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={typeof answer === 'number' && !Number.isNaN(answer) ? answer : ''}
                onChange={(e) => onAnswer(e.target.value === '' ? NaN : Number(e.target.value))}
                className="w-40 rounded-sm border border-border bg-bg px-2 py-1 num"
                aria-label={`답 (${q.unit})`}
              />
              <span className="text-muted">{q.unit}</span>
            </label>
          )}
          {q.type === 'true_false' &&
            [true, false].map((v) => (
              <label
                key={String(v)}
                className="flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-surface-2"
              >
                <input
                  type="radio"
                  name={groupId}
                  checked={answer === v}
                  onChange={() => onAnswer(v)}
                  className="accent-accent"
                />
                <span>{v ? '참(O)' : '거짓(X)'}</span>
              </label>
            ))}
        </div>
      </fieldset>
      {!submitted ? (
        <div className="mt-2">
          <Button size="sm" variant="primary" disabled={!answered} onClick={onSubmit}>
            제출
          </Button>
        </div>
      ) : (
        <div
          className={`mt-2 rounded-md border p-2 text-sm ${correct ? 'border-positive-border bg-positive-bg' : 'border-critical-border bg-critical-bg'}`}
          role="status"
        >
          <div className={`font-semibold ${correct ? 'text-positive' : 'text-critical'}`}>
            {correct ? '정답입니다' : '오답입니다'}
          </div>
          {!correct && (
            <div className="mt-0.5">
              <span className="text-muted">정답: </span>
              {answerText(q)}
            </div>
          )}
          <p className="mt-1">
            {q.explanation}
            {q.sourceRefs.length > 0 && <Citation ids={q.sourceRefs} local={localSources} />}
          </p>
        </div>
      )}
    </Card>
  )
}

export function Quiz({
  scenarioId,
  questions,
  localSources,
  previous,
}: {
  scenarioId: string
  questions: QuizQuestion[]
  localSources: Source[]
  previous: ScenarioProgress['quiz'] | undefined
}) {
  const recordQuiz = useProgressStore((s) => s.recordQuiz)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)
  const done = questions.length > 0 && questions.every((q) => submitted[q.id])
  const correctCount = questions.filter(
    (q) => submitted[q.id] && isCorrect(q, answers[q.id]),
  ).length

  useEffect(() => {
    if (!done || saved) return
    recordQuiz(scenarioId, {
      answers,
      correct: correctCount,
      total: questions.length,
      completedAt: new Date().toISOString(),
    })
    setSaved(true)
  }, [done, saved, recordQuiz, scenarioId, answers, correctCount, questions.length])

  if (questions.length === 0) return <p className="text-sm text-muted">퀴즈가 없습니다.</p>
  return (
    <div>
      {previous && !saved && (
        <p className="mb-2 text-sm text-muted num">
          이전 결과: {previous.correct}/{previous.total} ({shortDate(previous.completedAt)})
        </p>
      )}
      <ol className="m-0 list-none space-y-3 p-0">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            q={q}
            answer={answers[q.id]}
            submitted={Boolean(submitted[q.id])}
            onAnswer={(a) => setAnswers((s) => ({ ...s, [q.id]: a }))}
            onSubmit={() => setSubmitted((s) => ({ ...s, [q.id]: true }))}
            localSources={localSources}
          />
        ))}
      </ol>
      {done && (
        <p className="mt-3 rounded-md border border-border bg-surface-2 p-2 text-sm" role="status">
          결과:{' '}
          <b className="num">
            {correctCount}/{questions.length}
          </b>{' '}
          정답 {saved && <span className="text-muted">· 진행 현황에 저장되었습니다</span>}
        </p>
      )}
    </div>
  )
}
