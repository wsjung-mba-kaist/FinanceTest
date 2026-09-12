import { Link } from 'react-router-dom'
import { Button, Card } from '../ui'
import { buttonClass } from '../ui/buttonStyles'
import { Icon } from '../ui/Icon'
import { gridClass } from '../../lib/grid'
import { SCENARIOS } from '../../scenarios'

/**
 * The first card names how many scenarios are actually playable, derived from the registry so the
 * copy cannot go stale as scenarios land. Everything else is stable prose.
 */
function introCards(): { id: string; title: string; lead: string; rest: string }[] {
  const available = SCENARIOS.filter((e) => e.summary.status === 'available').map((e) => e.summary)
  const turns = available.map((s) => s.durationTurns)
  const turnRange = turns.length === 0 ? '7~9개' : `${Math.min(...turns)}~${Math.max(...turns)}개`
  // Naming every scenario stopped scaling past a handful; the span says as much in one clause and
  // stays true as the catalogue grows. Subtitles already carry their own year, so none is prepended.
  const byYear = available.slice().sort((a, b) => a.year - b.year)
  const first = byYear[0]
  const last = byYear[byYear.length - 1]
  const span =
    first && last && first !== last
      ? `${first.subtitle ?? first.title}부터 ${last.subtitle ?? last.title}까지`
      : (first?.subtitle ?? first?.title ?? '')
  return [
    {
      id: 'what',
      title: '무엇을 하는가',
      lead: `실제로 일어난 금융위기 ${available.length}편 — ${span} — 을 자금·리스크 책임자, 정책당국, 펀드 운용역의 자리에서 다시 겪습니다.`,
      rest: '각 시나리오는 공개된 감독 보고서와 1차 통계의 수치를 바탕으로 재구성했고, 화면에 나오는 모든 숫자는 출처를 따라갈 수 있습니다. 정답을 맞히는 퀴즈가 아니라, 불완전한 정보로 시간 안에 결정을 내리는 훈련입니다.',
    },
    {
      id: 'how',
      title: '어떻게 진행되는가',
      lead: `한 편은 ${turnRange}의 턴으로 이루어지고 30~50분이면 끝납니다.`,
      rest: '위기가 격해지는 턴에서는 턴 안에서도 시각이 흐릅니다. 시계가 가는 동안 예금과 시장이 움직이고, 전화가 끼어들어 제한된 시간 안에 답을 요구하며, 결정에는 마감 시각이 있습니다. 감독관이나 인수 후보와는 여러 단계로 주고받으며 무엇을 얼마나 약속할지 고르고, 그 약속은 나중에 이행 여부로 평가됩니다. 확정하면 결과가 순서대로 펼쳐집니다. 브리핑에서 안내·표준·전문가 모드를 고를 수 있습니다. 진행 상황은 이 브라우저에만 저장되므로 중간에 닫아도 이어서 할 수 있습니다.',
    },
    {
      id: 'score',
      title: '무엇을 평가하는가',
      lead: '6개 역량과 적시성을 합쳐 7개 차원으로 채점합니다.',
      rest: '역량은 유동성 관리·자본과 손실 관리·시장리스크 판단·위기 커뮤니케이션·규제와 거버넌스·거시 정책 판단입니다. 점수는 선택한 옵션에 대한 전문가 평점과 실제 지표 결과를 함께 반영합니다. 디브리핑에서는 같은 시나리오를 실제 당사자가 택한 역사 경로, 전문가 권고 경로와 나란히 놓고 비교합니다.',
    },
  ]
}

/**
 * Value proposition shown to a first-time visitor. Collapses to a single line once the user has
 * engaged with a scenario or dismissed it (`설정.onboardingSeenAt`).
 */
export function Welcome({
  expanded,
  onHide,
  onShow,
}: {
  expanded: boolean
  onHide: () => void
  onShow: () => void
}) {
  if (!expanded) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Icon name="info" size={14} />
        <span>실제 위기 기록으로 훈련하는 의사결정 시뮬레이터입니다. 계정도 서버도 없습니다.</span>
        <Link to="/demo" className="underline">
          90초 둘러보기
        </Link>
        <Button size="sm" variant="ghost" onClick={onShow}>
          안내 다시 보기
        </Button>
      </p>
    )
  }
  return (
    <section aria-labelledby="welcome-h" className="space-y-3">
      <div>
        <h1 id="welcome-h" className="text-xl font-semibold tracking-tight">
          실제 위기 기록으로 훈련하는 의사결정 시뮬레이터
        </h1>
        <p className="prose-col mt-1 text-muted">
          계정도 서버도 없습니다. 진행 기록과 설정은 이 브라우저에만 저장되며, 언제든 내보내거나
          지울 수 있습니다.
        </p>
      </div>
      {/*
        One sentence each, with the rest behind a disclosure. The three bodies ran to 677 characters
        of unbroken Korean on the first screen a visitor ever sees — the length itself was the thing
        that stopped people reading it. Nothing is cut: 더 보기 holds the full text, and the
        sentence that survives is the one carrying the fact (편 수, 소요 시간, 채점 차원).
      */}
      <ul className={`grid list-none gap-3 p-0 m-0 ${gridClass('prose', 3)}`}>
        {introCards().map((c) => (
          <li key={c.id}>
            <Card as="article" className="h-full p-4">
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{c.lead}</p>
              <details className="group mt-1.5">
                <summary className="min-h-tap-dense cursor-pointer list-none text-sm text-accent marker:content-none">
                  <span className="group-open:hidden">더 보기</span>
                  <span className="hidden group-open:inline">접기</span>
                </summary>
                <p className="mt-1.5 text-sm text-muted">{c.rest}</p>
              </details>
            </Card>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/demo" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          <Icon name="clock" size={14} />
          90초 둘러보기
        </Link>
        <span className="text-sm text-muted">
          한 턴을 네 단계로 미리 봅니다. 저장되지 않습니다.
        </span>
        <Button size="sm" variant="ghost" onClick={onHide}>
          처음 안내 숨기기
        </Button>
      </div>
    </section>
  )
}
