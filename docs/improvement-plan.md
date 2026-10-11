# 코드베이스 개선 계획 (2026-10-11 전수 검토)

기준 커밋 `289f468`, 브랜치 `ccr-84087b87-yjtwuq`. 엔진·지표·lib, 시나리오·콘텐츠·무결성 테스트,
UI·스토어·영속성 세 축으로 나누어 모든 파일을 읽고, 핵심 주장은 코드 위치와 실행으로 확인했다.
각 항목에 **왜 그것이 문제이고 어떤 원리로 고치는가**를 함께 적었다 — 수정 목록이 아니라 판단의
근거를 남기는 것이 이 문서의 목적이다.

## 0. 요약

**현재 상태는 건강하다.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`가 모두 통과한다
(테스트 파일 93개, 1,384건 통과·8건 건너뜀, 빌드 6.3초). 결정론 계약(같은 seed·결정 → 같은 결과)은
13개 시나리오 × 10 seed로 검증되고, 엔진·지표 코드에 `Math.random`·`Date`가 없다는 린트가 걸려
있다. UI 규약 §1–§22는 거의 모두 테스트로 지켜지고 있고, 접근성 수준도 높다.

**그러나 "정확성 최우선"이라는 제품 원칙이 실제로 보증되는 범위는 선언보다 좁다.** 검토에서 드러난
핵심은 세 가지다.

1. **엔진 산술 버그 1건이 실재한다.** HTM 매각 뒤 잔여 HTM을 AFS로 재분류하는 코드가 장부가를 남긴
   채 시가를 0으로 만들어, 재분류 직후 미실현손실 KPI가 잔여 HTM 시가 전체로 뛴다. SVB 시나리오에서
   실행으로 재현했다(§A-1). 엔딩 조건과 채점이 이 값을 읽는다.
2. **출처 보증은 T0 상태, 한 방향에만 걸려 있다.** 턴 중 외생 수치(시장 금리·스프레드·티커)의 2/3가
   사실 원장에 없고, 초기 상태 리프 중 88개가 원장에 없으며, 열린 `VERIFY` 47건을 막는 게이트가 없다.
   가이드가 약속한 저작 린트 12개 중 구현된 것은 3개다(§B).
3. **UI 결함 3건은 사용자가 바로 만난다.** 밀도 설정이 라이브로 반영되지 않고, 진행 현황의 디브리핑
   링크가 어떤 행을 눌러도 최신 기록을 열며, 시간 초과 뒤 실행 취소가 즉시 다시 시간 초과로 확정된다
   (§C).

이 밖에 CI 동시성 설정 오류, 무결성 린터 경고 132건의 비추적, 영속성 스키마의 마이그레이션 부재,
초기 번들 896 KB 같은 구조적 부채가 있다. 계획은 **Phase 0(즉시 수정) → 1(보증 확장) → 2(구조) →
3(지속)** 순서로 두었고, 각 단계가 `pnpm validate`를 깨지 않는 것을 전제로 한다.

### 가장 먼저 할 열 가지

| #   | 항목                                                                   | 영역   | 노력 |
| --- | ---------------------------------------------------------------------- | ------ | ---- |
| 1   | HTM 재분류 산술 수정 + 회계 항등식 테스트                              | 엔진   | 낮음 |
| 2   | 밀도 설정 라이브 반영(deps 한 줄) + RTL 테스트                         | UI     | 낮음 |
| 3   | 디브리핑을 runId로 주소화                                              | UI     | 낮음 |
| 4   | 시간 초과 → 실행 취소 루프, 틱이 undo 창을 자르는 불일치               | UI     | 낮음 |
| 5   | CI `concurrency` 그룹 분리(지금은 모든 PR·main이 서로를 취소)          | 도구   | 낮음 |
| 6   | fx 빌더 21개에 "전표" 단위 테스트                                      | 엔진   | 중간 |
| 7   | 원장 검사 양방향화 + VERIFY·무결성 경고 ratchet                        | 콘텐츠 | 낮음 |
| 8   | 린트 규칙 추가(마감 자동확정 × 다중선택, 빈 components, ccy 기본값 등) | 엔진   | 낮음 |
| 9   | 영속성 `migrate()` 사다리와 손상 백업 정리                             | 저장   | 중간 |
| 10  | 초기 번들 분리(도움 시트·recharts·콘텐츠 lazy)                         | UI     | 중간 |

## 1. 검토 방법

- 게이트 실행: `pnpm install --frozen-lockfile` 후 typecheck·lint·test·build를 순서대로 실행하고
  로그를 보존했다. 모두 종료 코드 0.
- 세 영역을 각각 전담 검토자가 **파일을 직접 읽고** 보고했다. 보고된 주장 중 계획의 근거가 되는
  것은 내가 코드 위치를 다시 열어 보거나(밀도 deps, 디브리핑 링크, lib→store import, `React.memo`
  0건, 원장 검사 범위, VERIFY 수) 실행으로 재현했다(HTM 재분류).
- 콘텐츠 통계(원장 행 태그, 상태 리프 커버리지, op/티커 원장 외 비율)는 13개 `scenario.ts`를 번들해
  노드에서 순회한 수치다.

## 2. 발견 사항

표기: **[확인]** 코드·실행으로 직접 확인 · **[보고]** 검토자 보고를 코드 위치로 대조 · **[추정]**
합리적이나 재현하지 않음.

### A. 엔진·지표 정확성

#### A-1. HTM 재분류 산술 **[확인·높음]**

`src/engine/fx/bank.ts:58-65`. HTM 일부 매각으로 tainting이 발생하면 잔여 HTM을 AFS로 옮기는데,

```ts
b.securities.htm.bookValue = b.securities.htm.marketValue // 장부가에 옛 시가를 남김
b.securities.afs.marketValue += b.securities.htm.marketValue
b.securities.afs.bookValue += b.securities.htm.marketValue // AFS 장부가에 시가를 더함
b.securities.htm.marketValue = 0 // 시가만 0
```

이후 `src/metrics/byInstitution.ts:69`의 `htmLoss = max(0, bookValue − marketValue)`가 잔여 HTM
시가 전체를 손실로 계산한다. SVB 시나리오(seed 1, variance 0)에서 T0~T2를 역사 선택으로 진행한 뒤
`t3-c`를 고르면:

| 시점            | HTM 장부/시가 | AFS 장부/시가 | 미실현손실 KPI | 경제적 TCE |
| --------------- | ------------- | ------------- | -------------- | ---------- |
| t3-c 직전       | 91.3 / 74.9   | 5.3 / 4.7     | 17.0           | −2.7%      |
| t3-c 직후(현재) | 49.9 / 0      | 55.3 / 54.7   | **50.5**       | **−22.3%** |
| 올바른 값       | 0 / 0         | 66.6 / 54.7   | ≈ 11.5         | ≈ −4%      |

두 오류가 겹친다. (a) 잔여 HTM의 장부가가 남아 시가 전체가 손실로 잡힌다. (b) AFS 장부가에 시가를
더하므로 AOCI 옵트아웃 은행(SVB)에서는 잔여 손실이 AFS AOCI로 넘어가지 않는다 — (a)만 고치면 손실이
아예 사라진다. `svb-2023/scenario.ts:339`의 `survived_strong` 엔딩(`economicTce > 2`)과 채점
(`scoring.ts:48`)이 이 값을 읽고, 현재 테스트는 이 경로에서 NaN 여부만 본다.

**원리.** ASC 320 재분류는 자산의 *장부가*를 다른 계정으로 옮기는 것이다. 시가를 장부가로 만들면
손실이 사라지고, 장부가를 남기면 손실이 두 번 잡힌다. 올바른 불변식은 "재분류 전후 `afs.bv + htm.bv`
불변, `afsLoss + htmLoss` 불변"이며, 이 두 항등식을 테스트로 적어 두면 `computeCapital`과 fx가 따로
진화해도 깨지는 순간 보인다.

#### A-2. 효과 빌더 21개에 단위 테스트가 없다 **[보고·높음]**

`src/engine/fx/{bank,pension,securities}.ts`의 빌더는 시나리오 경로를 통해서만 간접 검증된다.
A-1이 살아남은 이유이고, `pensionFx.meetMarginCall`(`pension.ts:74-79, 111`)이 풀 현금으로 낸
마진을 NAV에 두 번 세는 문제도 같은 부류다(현재 시나리오는 이 빌더 대신 `uk-ldi-2022/ldiFx.ts`에
"NAV 불변"으로 재구현해 우회하고 있다 — 엔진 빌더가 틀렸음을 작성자가 알고 있었던 흔적).

**원리.** 효과 빌더는 작은 회계 전표다. 전표는 차변과 대변이 맞아야 하고, A-1·A-2는 모두 "한
계정만 움직인" 전표다. 빌더마다 현금·자산·자본·카운터의 변화를 대차 항등식으로 단언하는 테스트는
시나리오를 로드하지 않으므로 빠르고, 21개뿐이라 하루 작업이다.

#### A-3. 채점은 턴 종료 값만, 게임오버는 틱 값을 본다 **[확인·중간]**

`src/engine/core/metrics.ts:66-68`은 턴 스냅샷을 틱마다 덮어쓴다(설계상 "턴당 1개"). 따라서
`score.ts:38-65`의 `aggregate: 'min' | 'turnsBelow'`는 틱 내 최저점을 보지 못한다. 반면
`checkGameOver`는 매 틱 실행된다. 5틱 턴에서 tick 2에 LCR 70, tick 4에 105면 "최저 LCR 105"로
만점이 된다. 채점 설명문 "최저 LCR"은 실제로는 "턴 종료 시점 최저"다.

**원리.** 해상도가 다르면 "게임오버는 안 됐지만 기준선 아래로 떨어진" 런이 만점이 된다. cap이 있는
`tickHistory`를 채점에 쓰기보다, 스냅샷 갱신 시 지표별 `intraMin/intraMax`를 누적하는 편이 싸고
결정론적이다. 전환하면 역사 경로 점수가 움직이므로 보정 노트 갱신이 따른다.

#### A-4. 마감 자동 확정 × 다중 선택 교착 **[확인·중간, 린트 공백]**

`tick.ts:146-156`은 마감 시 옵션 하나만 `applyDecision`에 넘긴다. `select.min ≥ 2`인 결정이면
`select_count` 예외 → 로그만 남고 미해결 → `advanceTurn`이 던지고 → 플레이어는 "다음 턴"을 영원히
누를 수 없다. 현재 13개 시나리오는 모두 min 1이라 안전하지만, `scenarioIntegrity.ts`에 검사가 없어
저작 한 줄로 재현된다.

**원리.** 엔진이 런타임에 로그로 삼키는 실패는 저작 시점의 린트 에러여야 한다. 이 코드베이스가
`validate/`를 둔 이유이고, 규칙마다 네거티브 테스트를 붙이면 린트 자체도 회귀 보호를 받는다
(현재 `tests/integrity/scenarios.test.ts`는 "에러 0건"만 단언하고 린트의 네거티브 케이스는 대화
린트에만 있다).

#### A-5. 결정론 위생 세 건 **[확인·낮음]**

- `noise.ts:58` `Math.round(base + offset × 0.5)`: JS는 .5를 올림하므로 variance 0.5에서 −0.5는
  0, +0.5는 +1이 된다. 이벤트·인터럽트가 늦어지기만 하고 앞당겨지지 않는다 — "노이즈는 결과를
  한쪽으로 밀지 않는다"는 파일 머리의 계약 위반.
- `autoplay.ts:108` `sort(() => rng() − 0.5)`: 비일관 비교자. 같은 엔진에서는 재현되지만 명세가
  균일 분포를 보장하지 않는다. Fisher–Yates 세 줄이면 된다.
- `createGame.ts:5` `JSON.parse(JSON.stringify())`: `Infinity`·`NaN`이 조용히 `null`이 된다.
  `structuredClone`이나 "초기 상태에 비유한 값 없음" 린트.

**원리.** 결정론("같은 입력 → 같은 출력")과 공정성("노이즈가 한쪽으로 밀지 않음")은 다른 성질이고
둘 다 테스트할 수 있다. N회 지터의 평균 offset ≈ 0을 단언하는 분포 테스트 하나면 재발하지 않는다.

#### A-6. 그 밖의 설계 부채 **[보고]**

- 통화 단위를 모르는 기본 임계값: `thresholds.ts:17 facilityHeadroom {warn: 10}`과
  `scoring/defaults.ts:187 realizedLoss [0, 1000, 5000]`는 `ccy` 지표인데 `units.scale`을 받지
  않는다. $B 시나리오의 10과 조원 시나리오의 10은 다른 숫자다. 지금은 13개 모두 오버라이드하지만,
  "ccy 지표는 시나리오 필수" 린트가 맞다.
- 듀레이션 P&L 3중 구현: `metrics/bondPnl.ts`(볼록성 포함, 인용 있음)와 `fx/bank.ts rateShock`,
  `fx/pension.ts yieldShock`(볼록성 없음). 인용된 산식과 실제 상태를 바꾸는 산식이 다르다. LDI
  시나리오는 130bp+ 충격이라 선형 근사가 수 %p 과대 손실을 낸다.
- 미사용 계산기: `computeNsfr`·`computeIrrbb`·`computeBondPnl`은 `src/metrics` 밖 참조가 0이다.
  테스트는 통과하지만 제품 경로에 없는 "검증된 것처럼 보이는" 코드.
- 문자열 키 프로토콜: counter/flag 키 26개(`amplifier`, `useKrLcr`, `hintPenalty`…)를 fx·metrics·
  lib이 암묵적으로 공유한다. 오타는 컴파일을 통과하고 `?? 0`으로 조용히 기본값이 된다.
- `KR_LCR_PARAMS ≡ BCBS_LCR_PARAMS`(`lcr.ts:31-76`)라 `useKrLcr` 스위치가 no-op이면서 "KR은 다른
  산식"이라는 거짓 신호를 준다.
- 제네릭 `S extends InstitutionState`가 엔진 내부에서 `as unknown as` 14회, `as GameState` 29회로
  지워진다. 호출자에게 주는 안전은 `scenario.initialState.institution` 정도다.
- 채점 가장자리: 빈 `components: []`가 일률 50점, `expertAlignment`(비가중)와 `expert` 컴포넌트
  (가중) 불일치, `decisionRegrets`가 당시 선택 불가능했던 옵션을 "최선"으로 지목, `undoChoice`가
  `run.hintsRevealed`를 되돌리지 않아 재선택 시 감점 재부과.

성능은 병목이 없다(전이 1회 마이크로초, SVB 전체 autoplay < 300 ms가 테스트로 고정). O(n²) 없음.

### B. 시나리오·콘텐츠의 출처 규율

#### B-1. 원장 검사는 T0 상태, 한 방향에만 걸려 있다 **[확인·높음]**

`tests/integrity/facts.test.ts:27, 82-95`는 `institution/market/confidence/counters/regulatorLevel`
루트의 **초기 상태 값만**, **원장 행 → 상태** 방향으로만 대조한다. 그 결과:

- 초기 상태 숫자 리프 864개 중 88개가 원장에 없다. `svb-2023`(워크드 예제)이 76개 중 44개(58%)로
  최악이고, `taeyoung-pf-2024` 24/109, `lehman-2008` 13/81(runoffByState 전부), `korea-imf-1997`
  5/47(confidence 전부).
- 턴 `entryEffects`의 `op('market.*', 'set', …)` 401개 중 270개(67%), 틱 티커 값 531개 중 348개
  (66%)가 원장의 어떤 `value`와도 일치하지 않는다. 가이드 §4.1이 요구하는 `timeline.ts`를 가진
  시나리오는 0개다.
- 열린 `VERIFY` 47건(9개 시나리오)을 막는 게이트가 없다. 가이드 §5.2의 `no-verify-in-release`는
  미구현이다. 각 VERIFY에는 해소 경로가 주석으로 적혀 있어 연구 품질은 높지만, "릴리스 시 0건"이라는
  가이드 문장과 양립하지 않는다 — 가이드를 고치든 ratchet을 두든 해야 한다.

스팟체크(SVB 3/9 $42B·종가 −$958M, CS 일별 유출·AT1 16B, 길트 30y 3.8→5.1%, LTCM, 아케고스,
1997 가용보유액, 태영 동의율)에서 **틀린 숫자는 찾지 못했다.** 문제는 숫자가 틀린 것이 아니라 턴
중 숫자의 출처 사슬이 끊겨 있다는 점이다.

**원리.** 보증은 테스트가 들여다보는 곳까지만 성립한다. 원장 검사가 T0·한 방향에 머물면 그 밖의
숫자는 저자 양심에 의존한다. 양방향(상태 리프 → 원장 행)으로 바꾸면 "원장에 없는 숫자"가 컴파일
타임 오류처럼 드러나고, 시나리오별 VERIFY 상한을 내려만 가는 ratchet으로 두면 추가는 막히고
해소는 기록된다. 이미 `tests/ui/primitiveAdoption.test.ts`가 같은 ratchet 패턴을 쓴다.

#### B-2. 사후정보 금지(no-hindsight)는 svb 한 곳만 데이터로 강제된다 **[보고·높음]**

`information.knownAt`이 붙은 이벤트는 svb 35개뿐이고 나머지 12개 시나리오는 0개다. 대신 12개 테스트
파일이 각자 손으로 쓴 금지 토큰 배열(`legoland.test.ts:85 HINDSIGHT_TOKENS`, `mg.test.ts:80
FORBIDDEN_IN_TURNS`)을 든다. 토큰 목록이 테스트에 있으면 DevInspector·UI 어디서도 재사용되지 않고,
시나리오마다 엄격도가 다르다. `docs/financial-expert-review.md`의 P1(레고랜드·LDI 정보 공개 시각)이
그대로 열려 있다.

**원리.** 사후정보 금지는 텍스트 속성이 아니라 _시각_ 속성이다. 이벤트 데이터(`knownAt`)에 살아야
리플레이·UI·린트가 같은 진실을 본다.

#### B-3. 가이드가 약속한 린트 12개 중 구현은 3개 **[보고·중간]**

`docs/authoring-guide.md` §5.2의 `numbers-have-sources`·`no-verify-in-release`·
`balance-sheet-balances`·`derived-metrics-match`·`no-hindsight`·`feasibility-present`·
`game-over-reachable`·`runoff-in-range`·`historical-path-reproduces`가 `scenarioIntegrity.ts`에
없다(일부는 시나리오별 테스트에 ad hoc로 흩어져 있다). §8의 필드명(`consequencesNarrative`,
`remediationConcept`, `tags: ['mistake']`, `turns.ts`)도 타입(`consequences`, `remediationCard`,
`trap`, `turnsA/B.ts`)과 어긋난다. `feasibility.basis`가 있는 옵션 비율은 svb 3/62부터 태영 62/71
까지 널뛴다.

**원리.** 가이드가 약속만 하면 신규 저자는 없는 린트를 믿고 실수를 놓친다. 없는 규칙은 "미구현"으로
표시하거나 구현해야 한다.

#### B-4. 무결성 린터의 경고는 아무도 세지 않는다 **[확인·중간]**

테스트는 에러 0건만 단언하고 경고 132건(`min-one-trap` 94, `option-label-length` 14,
`one-historical-per-decision` 14, `interrupt-last-tick` 8, `deadline-last-tick` 2)은 stderr로
흘러간다. 특히 `min-one-trap`은 `scenarioIntegrity.ts:357`에서 **결정마다** "시나리오 전체에 ≥1
필요"라는 메시지로 경고하고, `:493`에서 다시 시나리오 단위로 에러를 낸다 — 같은 규칙이 두 번, 다른
수준으로 보고되어 94건의 소음이 된다.

**원리.** 경고가 소음이 되면 새 경고가 묻힌다. 규칙별 ratchet(시나리오당 경고 수 상한)과
`min-one-trap`의 결정 단위 경고 삭제가 먼저다.

#### B-5. 어휘·구조 불일치 **[보고·낮음]**

- `FactRow` 인터페이스가 13개 `facts.ts`에 각각 선언되어 있고, 단위 어휘가 `$B`/`USD_B`,
  `pct`/`%`, `KRW/USD`/`원/달러`, 루트가 `turn.`/`turns.`/`timeline.`/`anchor.`로 갈린다.
- `calibration.md`가 `korea-imf-1997`·`covid-2020-fund`에 없다(보정은 스펙 문서에 있음). 효과
  빌더 파일명이 `fx.ts`/`localFx.ts`/`ldiFx.ts`/없음, 테스트 파일명이 `cs/pf/sb/imf.test.ts`로
  제각각이라 glob으로 잡기 어렵다. `turnsA/B` 분할 기준도 파일마다 다르다.
- `src/scenarios/index.ts`(496줄)는 13개 `meta`의 수동 사본이다(`scenarioSummary.test.ts`가
  지키지만 매번 두 번 적는다).
- 시나리오 로컬 효과 빌더 7,427줄 vs 엔진 `fx/` 866줄. 같은 개념(`sellSecurities`,
  `raiseFunding`)이 시나리오마다 다른 구현을 가질 수 있다.
- `legoland-2022`의 차환 결정 `t2-d1…t8-d1`은 결과 서사가 7턴 동일 — 반복 결정 팩토리 후보.
- 카탈로그 태그 70개 중 45개가 용어집에 없다. 시나리오 텍스트의 `term:` 링크는 0개.

#### B-6. 문서 드리프트와 잡동사니 **[확인·낮음]**

- `README.md:42`는 8개 시나리오를 한 행에 뭉친 "계획" 시절 표, `:25`는 원장·보정 노트가
  `svb-2023/`에만 있는 것처럼 적는다.
- `docs/scenarios/*.md` 8곳이 "M2/M3 시나리오"로 시작하고, 스펙의 `[VERIFY]` 수가 `facts.ts`와
  맞지 않는다. `docs/research/README.md` 끝의 "우선 재검증 항목"은 대부분 해소됐는데 갱신되지
  않았다.
- 저장소 루트의 `rumours.tmp.txt`는 커밋된 스크래치 파일이다.
- 테스트에 "registry scenarios are not available yet (skipped)" 플레이스홀더 8건이 남아 있다
  (`skipIf(registry.length > 0)`). 시나리오가 생기기 전의 흔적이며 지금은 항상 건너뛴다.

#### B-7. 교수설계 **[보고]**

모든 시나리오가 LO 3~~5개, LO당 ≥2 결정, 전문가 경로·교훈·퀴즈를 갖춘다. 약한 셋: `mg-run-2023`
(전문가 경로가 13개 결정 중 9개에서 역사와 같음, 체크포인트 허용폭 ±25~~35%), `svb-2023`(워크드
예제인데 원장 커버리지 최저·테스트 108줄·체크포인트 2개 — 다른 12개가 svb를 복제해 나아갔는데
원본이 뒤처졌다), `lehman-2008`(체크포인트 2개, 허용폭 ±30%). `Lesson`·`QuizQuestion`에 LO 필드가
없어 "무엇을 가르쳤는지"를 측정할 수 없다.

### C. UI·상태·영속성

#### C-1. 밀도 설정이 라이브로 반영되지 않는다 **[확인·높음]**

`src/app/providers.tsx:6-8`의 effect deps가 `[theme, fontScale, reducedMotion, useSystemFont]`뿐이라
`density`를 바꿔도 `applySettingsToDocument`가 다시 돌지 않는다. 설정 페이지에서 조밀/여유를 눌러도
새로고침 전까지 아무 일도 없고, 다른 설정을 건드리는 순간 갑자기 적용된다.
`tests/ui/density.test.ts`는 소스 텍스트에 `setAttribute('data-density'`가 있는지만 본다.

**원리.** 적용 함수와 그 트리거의 의존성 목록이 따로 살면 둘은 반드시 어긋난다. 적용 함수가 읽는
키 목록을 한 곳에서 export해 effect deps와 공유하면 어긋날 자리가 없다.

#### C-2. 진행 현황의 디브리핑 링크가 전부 최신 기록을 연다 **[확인·높음]**

`src/pages/ProgressPage.tsx:195`는 모든 행에서 `/debrief/${scenarioId}`로 보내고,
`DebriefPage.tsx`는 `attempts[0]`만 재구성한다. 세 번째 행을 눌렀는데 첫 번째 런의 디브리핑을 읽게
된다.

**원리.** 디브리핑은 `(scenario version, seed, decisions)`의 순수 함수라고 CLAUDE.md가 못 박았다.
그렇다면 URL이 그 입력을 가리켜야 "같은 링크 = 같은 디브리핑"이 성립한다. `?run=<runId>`로 주소화.

#### C-3. 실행 취소 창의 정합성 **[보고·높음]**

- `DecisionDock.tsx:209-226`: 시간 초과로 기본 옵션이 확정되면 비전문가 모드는 5초 undo 창을
  연다. Z로 되돌리면 `DecisionBlock`이 다시 마운트되는데, 언마운트 cleanup이 `burnedMs = limit`을
  초안에 남겨 두어 예산이 0 → 마운트 직후 다시 시간 초과 → 같은 기본값으로 즉시 재확정. 토스트는
  "실행 취소"를 권하지만 눌러도 아무것도 되돌아오지 않는다.
- `gameStore.ts:320 tickAdvance`가 `undoable`을 지우므로 ×4 속도(틱 2초)에서 "5초" 토스트가 2초
  만에 사라진다 — 표시된 숫자와 실제 창이 다르다.
- `useUndoWindow.ts:35-40`은 만료 시 `clearUndo`를 **무조건** 호출해, 만료 렌더와 effect 사이에
  새 `choose()`가 끼면 새 창을 지운다. `clearUndo(until)`로 "그 창만" 닫게 하면 경합이 없어진다.
- `useUndoWindow` 테스트 0건.

**원리.** 되돌리기의 유일한 요구는 "되돌릴 수 있다고 말한 만큼 되돌아간다"이다. 토스트 숫자와 실제
창이 다르거나 누른 결과가 원점이 아니면 사용자는 이후 모든 실행 취소를 믿지 않는다.

#### C-4. 초기 번들 896 KB(gzip 298 KB) **[확인·중간]**

| 청크                 | raw        | gzip     | 내용                                                              |
| -------------------- | ---------- | -------- | ----------------------------------------------------------------- |
| `index-*.js`         | 896 KB     | 298 KB   | React·router·zustand·zod·immer·엔진·metrics·콘텐츠·react-markdown |
| `useChartType-*.js`  | 361 KB     | 102 KB   | recharts(Play/Debrief/Progress 공용)                              |
| `scenario-*.js` × 13 | 136–244 KB | 46–76 KB | lazy — 정상                                                       |

원인은 구조적이다. 셸의 `HelpProvider`(`router.tsx:113`) → `HelpSheet` → 6개 탭 컴포넌트가 정적
import이고, 그 아래 `gameStore`(→ 엔진 전체), `content/index.ts`(`loader.ts`의 eager glob으로 카드·
프레임워크 마크다운 250 KB), `Markdown`(react-markdown)이 모든 라우트의 import 그래프에 묶인다. 홈
화면이 카탈로그 카드 한 장을 그리는 데 300 KB gzip을 내려받는다.

**원리.** 정적 import 그래프는 "필요할 수도 있는 것"과 "지금 필요한 것"을 구분하지 않는다. 경계
(라우트·탭·디스클로저)마다 lazy 경계를 하나씩 두면 사용자가 실제로 건너는 경로만큼만 내려받는다.

#### C-5. 영속성 스키마에 마이그레이션 경로가 없다 **[확인·중간]**

`src/persistence/schema.ts:3` `STORAGE_VERSION = 1`이 `z.literal`로 박혀 있다. 버전을 2로 올리는
날 `loadValidated`는 모든 사용자의 진행 데이터를 "손상"으로 분류해 백업하고 빈 상태로 시작한다.
`backupCorrupt`(`storage.ts:41-48`)는 손상 로드마다 전체 원본을 새 키로 복사하고 아무도 지우지
않는다 — 손상 상태로 N번 열면 N개 사본이 quota를 채운다. `settingsStore.update`는 `SaveResult`를
버려 설정 저장 실패가 어디에도 보이지 않고, 플레이 중 저장 실패는 40분 뒤 디브리핑에서야 알게 된다.

**원리.** `z.literal(1)`은 "이 버전만 받는다"지 "이전 버전을 올린다"가 아니다. 버전 번호는 올릴
계획이 있을 때만 의미가 있고, 올리는 날의 비용은 올리기 전에 치러 둬야 한다.

#### C-6. 컴포넌트 구조 **[확인/보고·중간]**

- `DecisionDock.tsx` 976줄. `DecisionBlock` 하나가 선택 모델·디바운스 프리뷰·응답 타이머·초안
  부기·키보드·마크업을 모두 소유한다. C-3 버그는 "초안 부기 × 타이머 × undo"의 교차점에서 났다.
- 계층 위반: `src/lib/useSimulationClock.ts:3`, `useUndoWindow.ts:2`, `logExport.ts:4`가
  `../store/gameStore`를 import한다(CLAUDE.md의 화살표는 lib이 store 아래).
- `React.memo`가 코드베이스에 0건. 틱마다 `usePlay()` 소비자 전부가 다시 그리고, recharts
  `TimeSeriesChart`는 대시보드 탭이 열려 있는 동안 매 틱 재애니메이션한다. `OptionComparison`은
  비교 패널이 열려 있는 동안 매 틱 최대 3회 `previewOption`(전체 `applyDecision` 복제)을 돌린다.
- 중복: `MODE_LABELS` 2벌, 죽은 `useMediaQuery`(`lib/useScenario.ts:49`), 이벤트 제목 추출 4벌
  (규칙이 조금씩 달라 같은 이벤트가 상황실과 피드에서 다른 제목), 평점→톤 임계 2벌, "바깥 클릭 +
  Esc" effect 3벌, 차트/표 토글 4벌, before→after 델타 행 5가지 모양(규약 §18·§19 준수 수준이
  제각각).

**원리.** 같은 규칙이 다섯 곳에 살면 규약은 "대체로" 지켜진다. 프리미티브 하나에 살면 "구조적으로"
지켜진다 — `Card`가 `card-key`를 이긴 이야기와 같은 교훈이다.

#### C-7. 접근성 구멍 **[보고·중간]**

잘 된 것이 훨씬 많다(포커스 트랩·복귀, 라우트·턴 전환 포커스, 탭 키보드 계약, 상태 글리프, 인쇄
팔레트, 강제색상). 남은 것:

- `aria-label`이 generic 요소(`span`·`div`)에 붙어 읽히지 않는다: `CountPill`, `KpiTile`,
  `PlayLayout` 결정 탭 점. `sr-only` 텍스트로 바꿔야 한다.
- §19 위반(색만으로 방향): `ConsequenceReel.MarketRow`, `MarketStrip`. `colourMeaning.test.ts`는
  세 파일만 검사하므로 통과한다.
- `role="menu"` 두 곳(`StatusBar`, `ClockControl`)이 화살표 키를 모른다.
- `?`/`H` 도움이 돌발 통화 중에는 안 열리고, 마우스로 열면 두 포커스 트랩이 겹친다.
- 모바일: `UndoToast`가 하단 탭바를 덮어 토스트가 뜬 5초 동안 "결정" 탭을 누를 수 없다.
- 턴 전환 시 라이브 리전 세 곳이 동시에 발화해 스크린리더가 세 문장을 겹쳐 읽는다.
- `SideSheet.tsx` `top-12`는 헤더 높이의 손 계산(§7-1이 금지한 형태).

### D. 테스트·도구·CI

#### D-1. CI 동시성 설정 오류 **[확인·높음]**

`.github/workflows/ci-pages.yml`의 `concurrency: { group: pages, cancel-in-progress: true }`가
`check`·`deploy` 두 잡 모두에, PR과 main 푸시 모두에 적용된다. 그룹 이름이 하나라 **어떤 PR의 새
푸시든 다른 PR의 실행 중인 검사와 main의 배포를 취소한다.** 단일 저자일 때는 드러나지 않지만 PR이
둘만 돼도 검사가 서로를 죽인다.

**원리.** `cancel-in-progress`는 "같은 대상의 낡은 실행"을 취소하기 위한 것이다. 그룹 키에 ref가
들어가야 한다(`ci-${{ github.ref }}`). 배포만 `pages` 그룹으로 직렬화하되 취소는 끄는 것이 GitHub의
권장 패턴이다.

#### D-2. 테스트 공백 지도 **[보고]**

- 엔진: fx 빌더 21개(A-2), `runoff/survival/thresholds/byInstitution`(참조 케이스 없음 — 다른
  9개 계산기는 모두 "reference:" 케이스가 있다), `noise`(분포), `score`의 `flag/survival/adjust`
  컴포넌트, `validateScenario` 네거티브 케이스, 손상 재생 로그.
- UI: `useUndoWindow`, `SettingsPage`, `ProgressPage` 링크, `HomePage` 이어하기/stale/버리기,
  `PlayPage`의 localStorage 복원 딥링크(모든 플레이 테스트가 `store.start()`로 들어간다), 모바일
  `PlayLayout`(모든 플레이 테스트가 1200px 데스크톱 스텁), `headings`에 briefing/debrief 없음.
- lib: `mastery`, `catalog`, `direction`, `template`, `labels`, `logExport`, `keyboard`.
- 플레이크 위험: `liveClock.test.tsx`는 실제 타이머(300 ms 틱, 4초 waitFor), `appWiring`·`headings`는
  전체 라우터 + lazy 페이지를 5초 타임아웃으로 기다린다.
- 소음: jsdom에 `ResizeObserver`·`window.scrollTo`가 없어 테스트 로그에 스택 23건이 찍힌다.
  `tests/setup.ts`에 스텁 두 줄이면 사라진다.

#### D-3. 도구·의존성 **[확인·낮음]**

- `pnpm outdated`: 메이저 뒤처짐 — React 18→19, recharts 2→3, eslint 9→10, typescript-eslint,
  `eslint-plugin-react-hooks` 5→7, jsdom 26→30, `@vitejs/plugin-react` 4→6, immer 10→11,
  TypeScript 5.9→7.0. 보안 이슈는 없으나 한꺼번에 올리면 UI 테스트가 무더기로 흔들린다.
- Dependabot/Renovate 설정 없음, PR 템플릿 없음, `pnpm test:visual`은 CI에 없음(의도된 결정이지만
  주간 스케줄 잡으로라도 돌릴 가치가 있다).
- `index.html`에 favicon·manifest·description 메타가 없다.
- 시나리오 테스트 파일명이 제각각이라 "시나리오 테스트만" glob으로 돌릴 수 없다.

## 3. 개선 계획

각 Phase는 독립적으로 머지 가능한 PR 단위로 나눴다. **모든 PR은 `pnpm validate`가 수치를 바꾸지
않는 것을 전제**로 하고, 바꾸는 PR(A-1, A-3)은 보정 노트와 체크포인트 갱신을 같은 PR에 담는다.

### Phase 0 — 즉시 수정 (1~2일, 각각 작은 PR)

| #   | 작업                                                                                                                                 | 파일                                                                  | 수용 기준                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | HTM 재분류 산술 수정: `afs.bookValue += htm.bookValue; afs.marketValue += htm.marketValue; htm.bookValue = htm.marketValue = 0`      | `src/engine/fx/bank.ts:58-65`                                         | 새 `tests/engine/fx/bank.test.ts`가 재분류 전후 `afs.bv+htm.bv`·`afsLoss+htmLoss` 불변 단언; `svb.test.ts`에 t3-c 경로의 `unrealizedLoss ≈ 11.5` 단언; 역사 경로 체크포인트 불변 확인 |
| 0.2 | 밀도 deps 수정: `applySettingsToDocument`가 읽는 키를 `SETTINGS_DOC_KEYS`로 export해 effect deps와 공유                              | `src/app/providers.tsx`, `src/store/settingsStore.ts`                 | RTL: 라디오 클릭 → `document.documentElement.dataset.density` 즉시 변경                                                                                                               |
| 0.3 | 디브리핑 runId 주소화: `/debrief/:id?run=<runId>`, `attempts.find(a => a.runId === run) ?? attempts[0]`                              | `DebriefPage.tsx`, `ProgressPage.tsx:195`, `HomePage`, `TerminalCard` | RTL: 진행 현황 둘째 행 클릭 → 그 런의 seed·점수가 디브리핑에 표시                                                                                                                     |
| 0.4 | undo 정합성: `clearUndo(until)`, 시간 초과 커밋에는 undo 창을 열지 않음(또는 undo 시 `burnedMs` 복원), 틱이 창을 닫을 때 토스트 안내 | `gameStore.ts`, `useUndoWindow.ts`, `DecisionDock.tsx:209-263`        | `useUndoWindow.test.tsx` 신설: 만료·특정 창만 닫기·틱 조기 종료·시간 초과 후 undo가 재확정되지 않음                                                                                   |
| 0.5 | CI concurrency: `check`는 `ci-${{ github.ref }}` + cancel, `deploy`는 `pages` + cancel 끔                                            | `.github/workflows/ci-pages.yml`                                      | 두 PR을 동시에 올려도 검사가 서로 취소되지 않음                                                                                                                                       |
| 0.6 | `min-one-trap` 결정 단위 경고 삭제(시나리오 단위 에러만 유지); jsdom에 `ResizeObserver`·`scrollTo` 스텁                              | `scenarioIntegrity.ts:357`, `tests/setup.ts`                          | 경고 132 → 38, 테스트 로그에 스택 0건                                                                                                                                                 |
| 0.7 | `rumours.tmp.txt` 삭제, 플레이스홀더 `skipIf(registry.length > 0)` 8건 제거, 죽은 `useMediaQuery`·`MODE_LABELS` 중복 제거            | 루트, `src/lib/*.test.ts`, `tests/**`, `lib/useScenario.ts`           | 건너뜀 0건                                                                                                                                                                            |
| 0.8 | README 시나리오 표·`:25` 갱신, `docs/scenarios/*` "M2/M3" 머리말 정리, `docs/research/README.md` 해소 항목 반영                      | `README.md`, `docs/`                                                  | —                                                                                                                                                                                     |

### Phase 1 — 정확성 보증 확장 (1주)

목표: "정확성 최우선"이 테스트로 성립하는 범위를 T0에서 전체 런으로 넓힌다.

| #   | 작업                                                                                                                                                                                                                                                     | 원리                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1.1 | fx 빌더 21개 "전표" 테스트(`tests/engine/fx/{bank,pension,securities}.test.ts`). 은행은 `Δcash + Δsecurities + … = Δequity + Δliabilities`, 연기금은 `equity == collateral + 파생 MTM`                                                                   | 전표는 차대가 맞아야 한다. 빌더마다 단독 테스트가 붙으면 시나리오를 로드하지 않고도 산술이 지켜진다                 |
| 1.2 | `pensionFx.meetMarginCall` NAV 이중 계상 수정 후 `uk-ldi-2022/ldiFx.ts postCollateral`을 엔진 빌더로 되돌림                                                                                                                                              | 엔진 빌더가 공개 API인 한 다음 연기금 시나리오가 그대로 쓴다                                                        |
| 1.3 | 린트 규칙 추가 + 규칙별 네거티브 테스트: 마감/인터럽트 × `select.min ≠ 1` 에러, 빈 `components`, 초기 상태 비유한 값, ccy 지표의 기본 임계값 사용, `Interrupt.deadlineTick` 미지정, `scoring.rules[*].metric`·`checkpoints.metric`이 `metricKeys`에 존재 | 런타임이 로그로 삼키는 실패는 저작 시점 린트 에러여야 한다                                                          |
| 1.4 | `facts.test.ts` 양방향화: 상태 리프 → 원장 행 검사를 공통으로 올리고 `cs/els/pf.test.ts`의 세 사본 삭제; 누락 88건은 시나리오별 상한 맵(ratchet)으로 시작해 내려만 가게                                                                                  | 보증은 테스트가 들여다보는 곳까지만 성립한다. ratchet은 추가를 막고 해소를 기록한다                                 |
| 1.5 | VERIFY ratchet(시나리오별 상한 47 → 내려만) + 가이드 §1.1·§2② 문장을 "ratchet 상한 이하"로 정정                                                                                                                                                          | 가이드와 코드가 다른 말을 하면 신규 저자는 가이드를 믿는다                                                          |
| 1.6 | 무결성 경고 ratchet(규칙 × 시나리오 상한) — `primitiveAdoption.test.ts`와 같은 패턴                                                                                                                                                                      | 경고가 소음이 되면 새 경고가 묻힌다                                                                                 |
| 1.7 | `runoff.ts` 앵커(SVB 3/9 25%, 3/10 80%, Signature 20%, CS 13.2/17.1/10.1bn)를 재현하는 참조 케이스; `survival`·`thresholds`·`byInstitution` 테스트                                                                                                       | 다른 9개 계산기가 가진 "reference:" 케이스가 이 넷에만 없다                                                         |
| 1.8 | 결정론 위생: `jitterTick` 대칭 반올림 + 평균 offset ≈ 0 분포 테스트, autoplay Fisher–Yates, `createGame` `structuredClone`                                                                                                                               | 결정론과 공정성은 다른 성질이고 둘 다 테스트할 수 있다                                                              |
| 1.9 | counter/flag 키 레지스트리(`src/engine/keys.ts`, `as const` + `KnownCounter` 유니온)                                                                                                                                                                     | 세 레이어가 암묵적으로 공유하는 프로토콜은 명시적 프로토콜로 바꿔야 오타가 컴파일 에러가 된다(`hintCost.ts`가 선례) |

### Phase 2 — 구조 (2~3주)

| #    | 작업                                                                                                                                                                                                          | 원리                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2.1  | 틱 내 극값 채점: `snapshotMetrics`에서 지표별 `intraMin/intraMax` 누적, `aggregate`에 `'intraMin'/'intraMax'` 추가, 기본 규칙의 "최저 LCR"·"최저 생존 일수" 전환, 보정 노트 갱신                              | 게임오버와 채점의 해상도가 같아야 "기준선 아래로 떨어졌지만 만점"이 없어진다                           |
| 2.2  | 영속성 `migrate(raw)` 사다리(버전별 단계 함수) + 손상 백업 최신 1개만 유지 + 설정 페이지 "백업에서 복구" + 설정도 내보내기에 포함 + 플레이 상태바에 저장 실패 표시                                            | 올리는 날의 비용은 올리기 전에 치러 둔다                                                               |
| 2.3  | 초기 번들 분리: `HelpBody` 탭별 `React.lazy`, 셸 provider의 배지 계산을 play 컨텍스트로 이동(HelpProvider가 gameStore를 모르게), recharts 4개 차트 lazy, `content/loader.ts` 비-eager                         | 경계마다 lazy 경계 하나. 목표: 홈 첫 로드 gzip 300 KB → 120 KB 이하                                    |
| 2.4  | `DecisionDock` 분할: `useDecisionTimer`(먼저 — C-3이 사는 곳), `useOptionSelection`, `useOptionPreview`, `DecisionNotes`, `Resolved/Pending/UpcomingRow`, `DockActionBar`, `useDecisionDrafts`                | 상태 기계 네 개가 한 컴포넌트에 살면 버그는 교차점에서 난다. 훅으로 나누면 교차점이 명시적 입력이 된다 |
| 2.5  | 계층 정리: `RunInfo` 타입을 `persistence/schema.ts`로, `useSimulationClock`·`useUndoWindow`를 `src/store/hooks/`로, `playHelpers`의 `engine/core/information` 깊은 import를 엔진 진입점 재수출로              | 화살표가 한 칸 꺾이면 다음 사람은 꺾인 자리를 기준으로 또 꺾는다                                       |
| 2.6  | 프리미티브 통합: `<DeltaRow>`(§18·§19를 구조적으로), `useDismissable`, `ChartOrTable`, `ratingTone()`, `eventTitle()` 1벌                                                                                     | 규약은 프리미티브에 살아야 "구조적으로" 지켜진다                                                       |
| 2.7  | a11y 묶음: generic `aria-label` → `sr-only`, `MarketRow`/`MarketStrip` 방향 낱말, 메뉴 화살표 키, 돌발 통화 중 `?` 허용, `UndoToast` 모바일 위치, `scrollIntoView` reduced-motion, 라이브 리전 중복 발화 통합 | 보이는 것과 들리는 것이 같은 말을 한다(§11·§19)                                                        |
| 2.8  | 메모이제이션: `TimeSeriesChart`를 `metricsHistory` identity로 memo + 라이브 중 애니메이션 끔, `OptionComparison` 프리뷰를 `state` 대신 턴·틱 키로, `previousTurnEntries`·`buildStripCells` memo               | 틱마다 전체 트리를 다시 그리는 것은 괜찮지만 recharts 재애니메이션과 `applyDecision` 3회는 아니다      |
| 2.9  | 제네릭 `S` 축소: 엔진 내부 시그니처를 `InstitutionState`로 고정하고 캐스트 43개 제거                                                                                                                          | 타입 매개변수가 호출자에 가치를 주지 못하고 구현에 비용만 주면 제거가 정답이다                         |
| 2.10 | 채점 가장자리: `expertAlignment` 가중치 통일, `decisionRegrets`가 당시 `when/requires`를 평가, `undoChoice`가 `hintsRevealed` 복원, `timeliness −10×timeouts`를 규칙으로                                      | 디브리핑 상단 수치와 `computeScore()`가 다르면 사용자는 둘 다 믿지 않는다                              |

### Phase 3 — 콘텐츠 규율과 저작 생산성 (지속, 시나리오 단위로)

| #    | 작업                                                                                                                                                                                                                 | 원리                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 3.1  | 외생 시계열 원장화: 턴 `entryEffects`/`ticker`의 `market.*` 값을 `facts.ts`(또는 가이드가 약속한 `timeline.ts`) 행에서 읽게 하고 "op/티커 값 → 원장 행" 역방향 검사. `els`·`legoland`의 `timeline.*` 패턴을 표준으로 | 가이드 §1.1 "턴에 등장하는 금리 하나까지 출처"가 T0 밖에서도 성립하게                                    |
| 3.2  | no-hindsight 데이터화: 12개 테스트의 토큰 배열을 `scenario.ts`의 `informationEmbargoes`로 옮기고 `information.knownAt`을 전 시나리오 이벤트에 부여, 린트는 `validate/information.ts` 하나로                          | 사후정보 금지는 시각 속성이다                                                                            |
| 3.3  | `_shared/facts.ts`에 `FactRow`·단위 enum·루트 어휘 정의, 13개 중복 인터페이스 제거, asOf ISO 린트                                                                                                                    | 어휘를 한 파일에 두면 린트가 생기고, 열세 곳에 두면 리뷰가 생긴다                                        |
| 3.4  | `docs/authoring-guide.md` §4.1·§5.2·§8을 코드와 맞추기(없는 린트는 "미구현" 표시, 필드명 정정, `turnsA/B` 현실 반영)                                                                                                 | 가이드가 약속만 하면 신규 저자는 없는 린트를 믿는다                                                      |
| 3.5  | `Lesson`·`QuizQuestion`에 `loId` 추가 + "각 LO에 교훈 ≥1·퀴즈 ≥1" 린트; `mg-run-2023` 전문가 경로 분기 확대·체크포인트 추가; `svb-2023` 테스트를 다른 12개 수준으로; `lehman` 체크포인트 보강                        | 결과(교훈·퀴즈)가 LO로 돌아오지 않으면 디브리핑이 무엇을 가르쳤는지 측정할 수 없다                       |
| 3.6  | 반복 결정 팩토리(`_shared/recurringDecision(spec, turn)`) — legoland `t2-d1…t8-d1`부터                                                                                                                               | 같은 문장이 일곱 번 있으면 여섯 번은 드리프트할 기회다                                                   |
| 3.7  | `turnsA/B` → `turns/t0.ts…tN.ts` 분할, 테스트·fx 파일명 통일(`<id>.test.ts`, `fx.ts`), `calibration.md`를 imf·covid에도                                                                                              | glob으로 잡히는 구조가 도구를 가능하게 한다                                                              |
| 3.8  | 프로즈 분리(하이브리드) 검토: 뉴스 본문·대사·결과 서사·rationale을 id 키 `.md`/YAML + zod 로더로, 효과·조건·대화 분기는 TS 유지. **완전한 JSON/YAML화는 권하지 않는다**                                              | 데이터인 것은 직렬화하고 코드인 것은 코드로 남겨야 둘 다의 도구(타입체커, 맞춤법·번역·리뷰)를 쓸 수 있다 |
| 3.9  | 카탈로그 태그 70개를 용어집 ID로 묶고 시나리오 텍스트에 `term:` 링크 도입                                                                                                                                            | 태그는 도움말 진입점이다                                                                                 |
| 3.10 | 의존성: 마이너 업그레이드 즉시, React 19 + `@types/react` 19 + `eslint-plugin-react-hooks` 7은 한 PR로(UI 테스트 영향 큼), recharts 3은 2.3 lazy 분리 뒤에, TypeScript 7은 보류; Dependabot 주간 그룹화              | 메이저는 묶어서 한 번에 검증하고, 마이너는 자동으로                                                      |

## 4. 하지 않기로 한 것 / 판단 보류

- **시나리오 전체를 JSON/YAML로 바꾸는 것.** `fnEffect`가 클로저를 담아 직렬화가 불가능하고,
  `when` 조건·지연 효과·대화 분기가 TS 타입으로 검증되는 가치가 크다. 3.8의 하이브리드가 상한이다.
- **`metricsHistory`를 틱 해상도로 바꾸는 것.** "턴당 1개"는 채점·조건·디브리핑이 의존하는 계약이다.
  2.1의 극값 누적이 같은 효과를 더 싸게 낸다.
- **recharts 3 즉시 업그레이드.** 2.3의 lazy 분리가 먼저다. 그래야 업그레이드 실패가 플레이 화면
  전체가 아니라 차트 하나에 국한된다.
- **긴 피드·로그의 가상화.** 9턴 시나리오에서는 불필요하고, 주 단위 시나리오도 수백 건 수준이다.
  `previousTurnEntries` memo(2.8)로 충분하다.
- **`pnpm format` 일괄 실행.** CLAUDE.md의 경고대로 마크다운 80개를 다시 쓴다. 바꾼 파일에만
  `npx prettier --write`.

## 5. 측정 지표

| 지표                                                 | 지금      | 목표(Phase 2 완료)         |
| ---------------------------------------------------- | --------- | -------------------------- |
| 초기 상태 리프 중 원장 외                            | 88 / 864  | 0(ratchet으로 내려감)      |
| 턴 중 `market.*` op 값 중 원장 외                    | 270 / 401 | 시나리오별 ratchet, 신규 0 |
| 열린 VERIFY                                          | 47        | ratchet 상한, 신규 0       |
| 무결성 경고                                          | 132       | 38 이하, 규칙별 상한       |
| fx 빌더 중 단위 테스트 있는 것                       | 0 / 21    | 21 / 21                    |
| 참조 케이스 없는 계산기                              | 4         | 0                          |
| 홈 첫 로드 gzip                                      | ≈ 300 KB  | ≤ 120 KB                   |
| 건너뛴 테스트(플레이스홀더)                          | 8         | 0                          |
| `lib → store` import                                 | 3         | 0                          |
| 가이드 §5.2 린트 중 구현                             | 3 / 12    | 12 / 12 또는 "미구현" 표기 |
| `useUndoWindow`·`SettingsPage`·`ProgressPage` 테스트 | 0 / 0 / 1 | 각 ≥ 3                     |

## 부록 — 검토 시점 수치

- 저장소: 커밋 27개(2026-09-11 ~ 09-14), 추적 파일 545개, 소스 118,787줄(시나리오 턴 파일 약
  36,000줄, 옵션 753·결정 219·이벤트 456개).
- 게이트: typecheck 0, lint 0, test 93 파일 / 1,384 통과 / 8 건너뜀 (50초), build 6.3초.
- 린트 억제 7건(모두 `exhaustive-deps` 또는 `only-export-components`), `any` 1건, non-null `!`
  7건(src, 테스트 제외), TODO/FIXME 0건.
- 사실 원장: 13개 시나리오 1,196행, `sourceId`·`asOf` 누락 0건, `knownAt` 28행, VERIFY 47 ·
  STYLIZED 274 · CAL 355 · 무태그 520.
- 결정론 점검: 엔진·지표에 `Math.random`·`Date` 없음(린트로 차단), RNG는 상태 안의 mulberry32,
  variance 0에서 무추첨 계약이 13개 × 10 seed로 검증됨.
