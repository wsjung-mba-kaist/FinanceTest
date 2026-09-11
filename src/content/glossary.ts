import type { GlossaryEntry } from './types'

/**
 * 용어집. 카드 본문은 `[표시 텍스트](term:<id>)`로만 명시적으로 링크한다(자동 링크 없음).
 * 정의의 수치는 docs/research 도시에에서 검증된 값만 쓰고, 미확인 값은 [2차]/[UNVERIFIED]로 표시한다.
 */
export const GLOSSARY: GlossaryEntry[] = [
  // ───────────── 유동성 규제 (Basel III) ─────────────
  {
    id: 'lcr',
    term: { ko: '유동성커버리지비율', en: 'Liquidity Coverage Ratio (LCR)' },
    aliases: ['LCR'],
    definition: {
      ko: '30일 스트레스 기간의 순현금유출을 고유동성자산(HQLA)으로 얼마나 덮는지 재는 Basel III 지표로, 최소 100%다. 한국 은행은 원화 LCR 100%(2025.1.1 복귀), 외화 LCR 80%를 적용받는다.',
      en: 'HQLA divided by 30-day net cash outflows under stress; minimum 100%.',
    },
    cardRef: 'lcr-basics',
    sourceRef: 'bcbs-238',
  },
  {
    id: 'hqla',
    term: { ko: '고유동성자산', en: 'High-Quality Liquid Assets (HQLA)' },
    aliases: ['HQLA'],
    definition: {
      ko: '스트레스 상황에서도 가치 손실 없이 즉시 현금화할 수 있는 자산으로 LCR의 분자다. Level 1은 헤어컷 0%·상한 없음, Level 2A는 15%, Level 2B는 25%(RMBS)·50%(회사채·주식)이며 L2 합계는 HQLA의 40%, 2B는 15%를 넘을 수 없다.',
      en: 'Assets that can be converted to cash quickly with little loss of value; numerator of the LCR.',
    },
    cardRef: 'hqla-and-haircuts',
    sourceRef: 'basel-lcr30',
  },
  {
    id: 'nsfr',
    term: { ko: '순안정자금조달비율', en: 'Net Stable Funding Ratio (NSFR)' },
    aliases: ['NSFR'],
    definition: {
      ko: '1년 기준으로 가용안정자금을 필요안정자금으로 나눈 Basel III 구조적 유동성 지표로, 상시 100% 이상이어야 한다. LCR이 30일 생존을, NSFR은 자산·부채 만기 구조의 안정성을 본다.',
      en: 'Available stable funding over required stable funding on a one-year horizon; at least 100% at all times.',
    },
    sourceRef: 'bcbs-d295',
  },
  {
    id: 'run-off-rate',
    term: { ko: '유출률', en: 'Run-off rate' },
    aliases: ['런오프율', '예금 유출률'],
    definition: {
      ko: 'LCR 계산에서 30일 안에 빠져나간다고 가정하는 부채 비율. 안정 소매예금 3%(예보 약할 시 5%), 비안정 소매 10% 이상, 운영성 예금 25%, 비금융기업·국가·공공기관 40%, 은행·증권·보험 등 기타 법인 100%다. 2023년 런은 이 30일 허용치를 하루 이틀 만에 소진했다.',
      en: 'Share of a liability assumed to leave within 30 days in the LCR; the 2023 runs exhausted 30-day allowances in one or two days.',
    },
    cardRef: 'uninsured-deposits-and-run-speed',
    sourceRef: 'basel-lcr40',
  },
  {
    id: 'cfp',
    term: { ko: '비상자금조달계획', en: 'Contingency Funding Plan (CFP)' },
    aliases: ['CFP'],
    definition: {
      ko: '유동성 스트레스 시 책임·발동 기준·조치 목록(금액·리드타임)·스트레스테스트 연계·커뮤니케이션·중앙은행 창구 준비를 미리 정한 계획. BCBS 144 원칙 11(¶110~117)이 국제 기준이며, 미국은 SR 10-6과 2023.7.28 인터에이전시 부록이 창구 사전 예치·주기적 테스트 거래를 요구한다.',
      en: 'Pre-agreed plan of who does what, in which order and how fast, when funding stress hits.',
    },
    cardRef: 'contingency-funding-plan',
    sourceRef: 'bcbs-144',
  },
  {
    id: 'ilst',
    term: { ko: '내부 유동성 스트레스테스트', en: 'Internal Liquidity Stress Test (ILST)' },
    aliases: ['ILST'],
    definition: {
      ko: '은행이 자체 가정으로 30일 등 기간의 유동성 부족을 계산하는 내부 테스트. SVB는 4Q22 ILST 30일 부족이 반복되자 FHLB 차입을 늘리는 한편 가정을 완화했고, 연준 사후평가(p.72, 78)가 이를 실패 지점으로 지목했다.',
    },
    cardRef: 'contingency-funding-plan',
    sourceRef: 'fed-svb-review-2023',
  },

  // ───────────── 자본 규제 ─────────────
  {
    id: 'cet1',
    term: { ko: '보통주자본', en: 'Common Equity Tier 1 (CET1)' },
    aliases: ['CET1', '보통주자본비율'],
    definition: {
      ko: '보통주와 이익잉여금으로 구성된 최고 품질의 규제자본. Basel III 최소 4.5%에 자본보전완충자본 2.5%를 더한 7.0%가 실질 하한이며, 한국 D-SIB는 경기대응완충자본 1%·D-SIB 추가자본 1%를 더해 CET1 9.0%·총자본 12.5%를 요구받는다.',
      en: 'Highest-quality regulatory capital (common shares and retained earnings) over risk-weighted assets; 4.5% minimum plus 2.5% conservation buffer.',
    },
    cardRef: 'economic-vs-regulatory-capital',
    sourceRef: 'bcbs-189',
  },
  {
    id: 'at1',
    term: { ko: '기타기본자본', en: 'Additional Tier 1 (AT1)' },
    aliases: ['AT1', '신종자본증권', '코코본드'],
    definition: {
      ko: '영구 후순위·조건부 상각 또는 전환 조건을 가진 자본증권으로 Tier 1에 산입된다. 2023.3.19 UBS의 CS 인수에서 AT1 CHF 16.5B가 전액 상각되며 주주(CHF 3B)보다 후순위가 되어 논란이 됐고, 2025.10.14 스위스 연방행정법원이 위법 판결했다. 한국에서는 2022.11 흥국생명의 콜옵션 미행사(11/1)와 번복(11/9)이 시장 접근성 훼손 사례로 남았다.',
      en: 'Perpetual, loss-absorbing capital instruments written down or converted at a trigger; CHF 16.5B of CS AT1 was written off in March 2023.',
    },
    cardRef: 'capital-raise-sequencing',
    sourceRef: 'finma-cs-report-2023',
  },
  {
    id: 'tier2',
    term: { ko: '보완자본', en: 'Tier 2 capital' },
    aliases: ['Tier 2', 'T2', '후순위채'],
    definition: {
      ko: '만기 있는 후순위채 등 청산 시에만 손실을 흡수하는 규제자본으로, 총자본 8% 요건에 포함된다. 2011년 부산저축은행 파산에서 후순위채 8,571억은 규제상 자본이었지만 개인 투자자에게는 손실이 됐다.',
      en: 'Subordinated, dated capital that absorbs losses only in liquidation; counts toward the 8% total capital ratio.',
    },
    cardRef: 'economic-vs-regulatory-capital',
    sourceRef: 'bcbs-189',
  },
  {
    id: 'rwa',
    term: { ko: '위험가중자산', en: 'Risk-Weighted Assets (RWA)' },
    aliases: ['RWA'],
    definition: {
      ko: '자산별 위험가중치를 곱해 합산한 규제자본비율의 분모. 위험가중치가 낮은 국채·MBS는 자본 부담 없이 금리 리스크를 키울 수 있고, 한국은 2025.12.23 PF 제도개선 최종안에서 은행 PF 위험가중치를 100/120/130/150%로 세분화했다.',
      en: 'Denominator of capital ratios: exposures weighted by regulatory risk weights.',
    },
    cardRef: 'economic-vs-regulatory-capital',
  },
  {
    id: 'leverage-ratio',
    term: { ko: '레버리지비율', en: 'Leverage ratio' },
    definition: {
      ko: 'Tier 1 자본을 위험가중하지 않은 총익스포저로 나눈 비율로 Basel III 최소 3%다. 위험가중치가 낮은 자산으로 대차대조표를 키우는 것을 제한하는 백스톱이며, 한국 증권사에는 별도의 레버리지비율 적기시정조치 기준이 있다[규정 원문 미확인].',
      en: 'Tier 1 capital over total (unweighted) exposure; 3% minimum under Basel III.',
    },
    cardRef: 'economic-vs-regulatory-capital',
    sourceRef: 'bcbs-189',
  },
  {
    id: 'ccb',
    term: { ko: '자본보전완충자본', en: 'Capital Conservation Buffer (CCB)' },
    aliases: ['CCB'],
    definition: {
      ko: 'CET1 최소 4.5% 위에 쌓는 2.5%의 완충자본. 미달하면 배당·자사주 매입·성과급 지급이 단계적으로 제한되며, 이 플랫폼의 감독당국 반응 R2 트리거(CET1 < 7.0%)가 이 문턱이다.',
      en: '2.5% CET1 buffer above the minimum; breaching it triggers distribution restrictions.',
    },
    cardRef: 'regulator-escalation-ladder',
    sourceRef: 'bcbs-189',
  },
  {
    id: 'ccyb',
    term: { ko: '경기대응완충자본', en: 'Countercyclical Capital Buffer (CCyB)' },
    aliases: ['CCyB'],
    definition: {
      ko: '신용 팽창기에 0~2.5%p 범위에서 추가로 부과하고 위기 시 풀어 주는 완충자본. 한국은 2024.5.1부터 1%를 적용하고 있다.',
      en: 'A 0-2.5% buffer raised in credit booms and released in stress; Korea applies 1% since May 2024.',
    },
    sourceRef: 'bcbs-189',
  },
  {
    id: 'tce',
    term: {
      ko: '경제적 자본(유형보통주자본)',
      en: 'Tangible Common Equity (TCE) / economic capital',
    },
    aliases: ['TCE', '경제적 TCE'],
    definition: {
      ko: '보통주자본에서 무형자산을 빼고 AFS·HTM 미실현손실을 세후로 차감한, 시장이 보는 자본. SVB의 양식화 계산은 12.7 − (2.5 + 15.1) × (1 − 25%) ≈ 0($B)이며, 이 플랫폼은 TCE/총자산 ≤ 2%를 게임오버·R4 트리거로, > 3%를 인수자 게이트로 쓴다.',
      en: 'Common equity net of intangibles and after-tax unrealized securities losses; the solvency figure markets actually price.',
    },
    cardRef: 'economic-vs-regulatory-capital',
  },

  // ───────────── 증권 회계 ─────────────
  {
    id: 'aoci',
    term: { ko: '기타포괄손익누계액', en: 'Accumulated Other Comprehensive Income (AOCI)' },
    aliases: ['AOCI'],
    definition: {
      ko: 'AFS 증권의 미실현손익 등 손익계산서를 거치지 않고 자본에 직접 쌓이는 항목. 미국에서는 고급접근법을 쓰지 않는 은행이 AOCI를 규제자본에서 제외(옵트아웃)할 수 있어, SVB는 옵트아웃으로 $1.9B의 CET1 효과를 얻고 있었다.',
      en: 'Equity component holding unrealized AFS gains/losses; many US banks may opt out of including it in regulatory capital.',
    },
    cardRef: 'afs-htm-aoci',
    sourceRef: 'fed-svb-review-2023',
  },
  {
    id: 'afs',
    term: { ko: '매도가능증권', en: 'Available-for-Sale (AFS) securities' },
    aliases: ['AFS'],
    definition: {
      ko: '공정가치로 평가하되 미실현손익을 AOCI에 반영하는 채권 분류. SVB는 2022.12.31 AFS 약 $26B에 손실 약 $2.5B를 안고 있었고, 2023.3.8 약 $21B를 매각해 세후 손실 약 $1.8B를 실현했다.',
      en: 'Debt securities carried at fair value with unrealized gains/losses in AOCI.',
    },
    cardRef: 'afs-htm-aoci',
    sourceRef: 'svb-8k-2023',
  },
  {
    id: 'htm',
    term: { ko: '만기보유증권', en: 'Held-to-Maturity (HTM) securities' },
    aliases: ['HTM'],
    definition: {
      ko: '만기까지 보유할 의도와 능력이 있다고 보아 상각원가로 계상하는 채권 분류로, 금리 변동에 따른 미실현손익이 재무제표 본문에 나타나지 않는다. SVB는 증권의 78%(약 $91B, 듀레이션 6.2년)를 HTM으로 두었고 미실현손실은 약 $15B[2차]였다.',
      en: 'Debt securities carried at amortised cost; unrealized losses appear only in footnotes.',
    },
    cardRef: 'afs-htm-aoci',
    sourceRef: 'fed-svb-review-2023',
  },
  {
    id: 'htm-tainting',
    term: { ko: 'HTM 테인팅', en: 'HTM tainting' },
    aliases: ['tainting', '테인팅'],
    definition: {
      ko: 'HTM 일부를 만기 전에 매각·재분류하면 ASC 320-10-35-8에 따라 잔여 HTM 전체를 AFS로 재분류해 미실현손실을 자본에 반영해야 하는 규칙. 자행의 런은 예외로 인정될 여지가 있으나 타행의 런은 인정되지 않는다(Deloitte 해석). 게임 보정은 HTM 매각에 ΔCI −30과 등급 검토를 부여한다.',
      en: 'Selling part of an HTM book taints the rest, forcing reclassification to AFS and recognition of all unrealized losses in equity.',
    },
    cardRef: 'htm-tainting',
    sourceRef: 'fasb-asc-320',
  },

  // ───────────── 예금·런 ─────────────
  {
    id: 'uninsured-deposits',
    term: { ko: '무보험 예금', en: 'Uninsured deposits' },
    definition: {
      ko: '예금보험 한도를 초과해 은행 실패 시 손실 위험에 노출되는 예금. SVB는 무보험 비중이 94%(지주 Y-9C) 또는 88%(FDIC)였고, 2023.3.9 하루에 $42B(약 25%)가 빠져나갔다. 동질적·네트워크형·디지털 채널 예금일수록 런 속도가 빠르다.',
      en: 'Deposits above the insurance limit; SVB had 88-94% uninsured and lost $42B in one day.',
    },
    cardRef: 'uninsured-deposits-and-run-speed',
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  {
    id: 'run-state',
    term: { ko: '런 상태', en: 'Run state (S0-S3)' },
    aliases: ['S0', 'S1', 'S2', 'S3'],
    definition: {
      ko: '이 플랫폼이 신뢰지수(CI)로 판정하는 예금 런의 4단계: S0 평온(CI ≥ 70), S1 우려(50~69), S2 공개 런(30~49), S3 붕괴(< 30). 세그먼트별 기본 일일 유출률이 상태마다 달라진다(예: 무보험 스타트업 예금 S1 3% → S2 35% → S3 95%).',
      en: 'Four-stage run model keyed to the confidence index; segment run-off rates rise sharply from S1 to S3.',
    },
    cardRef: 'bank-run-dynamics',
  },
  {
    id: 'confidence-index',
    term: { ko: '시장 신뢰지수', en: 'Confidence Index (CI)' },
    aliases: ['CI', '신뢰지수'],
    definition: {
      ko: '0~100 범위의 게임 내 신뢰 상태로, 이벤트별 ΔCI(손실 공개 + 미백스톱 증자 −25, 전면 보증 +40 등)와 자사 주가 수익률의 0.4배가 매 턴 더해진다. 런 상태(S0~S3)와 증자 성공 조건(CI ≥ 45 ∧ 백스톱 ≥ 50%)을 결정한다.',
      en: 'Game-state confidence score (0-100) driven by calibrated event deltas and own-stock returns.',
    },
    cardRef: 'bank-run-dynamics',
  },
  {
    id: 'fire-sale',
    term: { ko: '파이어세일', en: 'Fire sale' },
    aliases: ['투매', '헐값 매각'],
    definition: {
      ko: '유동성 확보를 위해 자산을 시장 소화 능력 이상으로 급히 팔아 가격을 스스로 떨어뜨리는 매각. 2022.9 영국 LDI 펀드는 담보 콜을 맞추려 13일간 £30bn 이상의 길트를 팔았고 그 매도가 다시 길트 가격을 눌렀다. 게임은 할인을 자기 체결가에만 적용한다(disc = k × (size/ADV)^0.5).',
      en: 'Forced selling that depresses the price of the very asset being sold; the 2022 gilt spiral is the canonical case.',
    },
    cardRef: 'hqla-and-haircuts',
    sourceRef: 'boe-qb-2023-gilt',
  },

  // ───────────── 중앙은행 창구·정리 ─────────────
  {
    id: 'discount-window',
    term: { ko: '재할인창구', en: 'Discount window' },
    aliases: ['연준 창구', '대출창구'],
    definition: {
      ko: '연준이 담보를 받고 은행에 대출하는 최종대부자 창구. 건전 은행용 1차 신용(primary credit)과 문제은행용 2차 신용(secondary credit)이 있으며, 담보는 사전 예치되어야 하고 FHLB 리엔이 있으면 해제가 선행돼야 한다. 2023.3.15 차입 잔액 $152.9B는 사상 최대였고, 퍼스트리퍼블릭은 4/28 2차 신용 전환으로 사실상 접근이 막혔다.',
      en: 'The Fed lender-of-last-resort facility; collateral must be pre-positioned and a CAMELS downgrade shifts a bank to secondary credit.',
    },
    cardRef: 'discount-window-fhlb-btfp',
    sourceRef: 'interagency-cfp-addendum-2023',
  },
  {
    id: 'fhlb',
    term: { ko: '연방주택대출은행', en: 'Federal Home Loan Bank (FHLB)' },
    aliases: ['FHLB', 'FHLB advance'],
    definition: {
      ko: '회원 은행에 사전 예치 담보로 advance를 제공하는 미국 정부후원기관. 담보에 선순위 리엔을 가지므로 연준 창구에 같은 담보를 쓰려면 후순위화가 필요하다. 2023.3.10 시그니처는 FHLB가 담보를 후순위화한 뒤에야 뉴욕연준 창구로 $3.4B를 결제했다.',
      en: 'US government-sponsored wholesale lender to member banks; its senior lien must be subordinated before the Fed can lend on the same collateral.',
    },
    cardRef: 'discount-window-fhlb-btfp',
    sourceRef: 'fdic-oig-signature-2023',
  },
  {
    id: 'btfp',
    term: { ko: '은행기간조달프로그램', en: 'Bank Term Funding Program (BTFP)' },
    aliases: ['BTFP'],
    definition: {
      ko: '2023.3.12 연준이 창설한 임시 대출 시설. 2023.3.12 보유 적격 증권을 시가가 아닌 액면(par)으로 평가해 최장 1년, 1년 OIS+10bp 고정금리, 수수료 없음, 조기상환 가능 조건으로 대출했고 외환안정기금(ESF) $25B가 백스톱했다. 3/15 잔액은 $11.9B였다.',
      en: 'Temporary Fed facility (Mar 2023) lending up to one year against securities valued at par, at 1-year OIS + 10bp.',
    },
    cardRef: 'discount-window-fhlb-btfp',
    sourceRef: 'fed-btfp-term-sheet-2023',
  },
  {
    id: 'lolr',
    term: { ko: '최종대부자', en: 'Lender of Last Resort (LOLR)' },
    aliases: ['LOLR'],
    definition: {
      ko: '지급능력은 있으나 유동성이 부족한 금융기관에 중앙은행이 담보를 받고 대출하는 기능. 2007.9.14 영란은행의 노던록 지원 발표는 보증 없이 이루어져 며칠 내 £4.6B 인출을 촉발했고 9/17 정부 보증으로만 끝났다. 한국은 한은법 65조(긴급여신)·80조·68조가 근거다.',
      en: 'Central-bank lending to illiquid but solvent institutions; an LOLR announcement without a guarantee can itself trigger a run (Northern Rock 2007).',
    },
    cardRef: 'discount-window-fhlb-btfp',
  },
  {
    id: 'stigma',
    term: { ko: '창구 낙인', en: 'Discount window stigma' },
    aliases: ['낙인', 'stigma'],
    definition: {
      ko: '중앙은행 창구를 쓰면 문제 은행으로 인식될 것이라는 우려 때문에 차입을 미루는 현상. 2023.7.28 인터에이전시 부록은 창구를 CFP에 포함하고 테스트 거래로 운영 준비를 유지하라고 명시했고, BTFP는 수수료 없음·조기상환 가능 조건으로 낙인을 낮추도록 설계됐다. 게임 보정은 비시스템 상황의 창구 사용에 ΔCI −3을 둔다.',
      en: 'Reluctance to borrow from the central bank for fear of signalling weakness.',
    },
    cardRef: 'discount-window-fhlb-btfp',
    sourceRef: 'interagency-cfp-addendum-2023',
  },
  {
    id: 'ela',
    term: { ko: '긴급유동성지원', en: 'Emergency Liquidity Assistance (ELA)' },
    aliases: ['ELA', 'ELA+'],
    definition: {
      ko: '중앙은행이 정규 창구 밖에서 개별 기관에 제공하는 긴급 대출. 스위스국립은행은 2023.3.16 CS에 ELA 38B + LSFF 10B, 3/17 긴급법령으로 창설된 ELA+ 20B(없었으면 정오 즉시 지급불능), 3/20~26 ELA+ 30B + PLB 70B를 제공해 총 CHF 168B를 지원했다.',
      en: 'Bespoke central-bank lending outside standing facilities; SNB support to CS totalled CHF 168B.',
    },
    cardRef: 'fdic-resolution-weekend',
    sourceRef: 'finma-cs-report-2023',
  },
  {
    id: 'plb',
    term: { ko: '공적유동성백스톱', en: 'Public Liquidity Backstop (PLB)' },
    aliases: ['PLB'],
    definition: {
      ko: '정부가 채무불이행 보증을 서서 중앙은행이 담보 없이도 대출할 수 있게 하는 장치. 스위스는 2023.3.16 긴급법령으로 PLB를 창설해 3/20~26 CHF 70B를 집행했고, UBS 인수에는 연방보증 CHF 100B(SNB)+9B(UBS)가 붙었다.',
      en: 'State-guaranteed central-bank liquidity created by emergency ordinance in Switzerland in March 2023.',
    },
    sourceRef: 'finma-cs-report-2023',
  },
  {
    id: 'bail-in',
    term: { ko: '베일인', en: 'Bail-in' },
    definition: {
      ko: '정리 시 주식·AT1·베일인 적격 채권을 상각하거나 출자전환해 납세자 대신 채권자가 손실을 지게 하는 수단. FINMA의 CS 선택지 ②(정리)는 이 방식으로 약 CHF 73B의 신자본이 필요하다고 추산됐으나 실제로는 UBS 합병(선택지 ⑤)이 선택됐다.',
      en: 'Writing down or converting creditor claims in resolution so losses fall on investors rather than taxpayers.',
    },
    cardRef: 'capital-raise-sequencing',
    sourceRef: 'finma-cs-report-2023',
  },
  {
    id: 'resolution',
    term: { ko: '정리', en: 'Resolution' },
    aliases: ['부실금융기관 정리'],
    definition: {
      ko: '실패한 금융기관을 시스템 충격 없이 처리하는 절차로 P&A·브릿지뱅크·청산·베일인·국유화 등을 포함한다. 미국은 리먼의 무질서 파산 이후 Dodd-Frank Title II 질서정리권한(OLA)을 두었고, 한국은 금산법의 적기시정조치·긴급조치와 2020.12 도입된 RRP 체계가 근거다.',
      en: 'Orderly handling of a failed institution via P&A, bridge bank, liquidation, bail-in or nationalisation.',
    },
    cardRef: 'fdic-resolution-weekend',
  },
  {
    id: 'rrp',
    term: { ko: '정상화·정리계획', en: 'Recovery and Resolution Plan (RRP)' },
    aliases: ['RRP', '자체정상화계획', '부실정리계획'],
    definition: {
      ko: '금융기관이 스스로 회복할 계획(자체정상화계획)과 당국이 정리할 계획(부실정리계획)을 매년 갖추는 제도. 한국은 금산법(2020.12)에 따라 D-SIFI 10개사가 대상이며, 자체정상화계획은 금감원 평가 후 금융위 승인(2026.4.15), 부실정리계획은 예보가 수립(2026.7.15)하고 2026 하반기 합동 모의훈련이 예정돼 있다.',
      en: 'Annual recovery plan by the bank and resolution plan by the authority; Korea covers 10 D-SIFIs under the FISCA framework.',
    },
    cardRef: 'fdic-resolution-weekend',
  },
  {
    id: 'systemic-risk-exception',
    term: { ko: '시스템리스크 예외', en: 'Systemic Risk Exception (SRE)' },
    aliases: ['SRE'],
    definition: {
      ko: 'FDIC의 최소비용 원칙을 벗어나 무보험 예금까지 보호할 수 있게 하는 예외. 2023.3.12 저녁 SVB·시그니처의 전 예금을 보호하되 주주·일부 무담보채권자는 보호하지 않는 방식으로 발동됐고, 같은 날 BTFP가 창설됐다.',
      en: 'Exception to the least-cost test allowing full deposit protection; invoked for SVB and Signature on 12 March 2023.',
    },
    cardRef: 'fdic-resolution-weekend',
    sourceRef: 'fed-btfp-term-sheet-2023',
  },
  {
    id: 'bridge-bank',
    term: { ko: '브릿지뱅크(가교은행)', en: 'Bridge bank' },
    aliases: ['가교은행', '가교저축은행'],
    definition: {
      ko: 'FDIC(한국은 예보)가 인수자를 찾을 때까지 실패 은행의 영업을 이어 가려고 세우는 임시 은행. 2023.3.13 SVB·시그니처에 설립됐고, 한국은 2011.10.19 예보 100% 출자의 가교 예솔저축은행을 세워 부산저축은행 등을 계약이전한 뒤 금융지주에 매각했다.',
      en: 'Temporary bank chartered by the resolution authority to keep a failed bank operating until sale.',
    },
    cardRef: 'fdic-resolution-weekend',
    sourceRef: 'fsc-71188',
  },
  {
    id: 'pna',
    term: { ko: '자산부채이전(P&A)', en: 'Purchase and Assumption (P&A)' },
    aliases: ['P&A', '계약이전'],
    definition: {
      ko: '건전 기관이 실패 기관의 예금(부채)과 자산을 인수하는 정리 방식으로 예금자 접근이 끊기지 않는다. 미국은 여러 유형이 있고 최소비용 원칙으로 선택된다. 한국 사례는 1998.6.29 5개 은행 퇴출 P&A, 2011.3.16 삼화→우리금융저축은행, 2023.7.10 새마을금고 "우량금고로 P&A → 5천만원 초과도 전액 보장"이다.',
      en: 'Resolution in which an acquirer takes over deposits and assets of the failed bank; depositors keep uninterrupted access.',
    },
    cardRef: 'fdic-resolution-weekend',
    sourceRef: 'fsc-80363',
  },
  {
    id: 'receivership',
    term: { ko: '관재', en: 'Receivership' },
    aliases: ['관재인', 'receiver'],
    definition: {
      ko: '인가 당국이 은행을 폐쇄하고 FDIC 등을 관재인으로 지정해 자산·부채를 처분하게 하는 법적 상태. 2023.3.10 캘리포니아 DFPI는 유동성 부족·지급불능을 이유로 SVB를 폐쇄하고 FDIC를 관재인으로 지정했다.',
      en: 'Legal status in which the resolution authority takes control of a closed bank to dispose of its assets and liabilities.',
    },
    cardRef: 'fdic-resolution-weekend',
    sourceRef: 'dfpi-svb-order-2023',
  },
  {
    id: 'dinb',
    term: { ko: '예금보험국법은행', en: 'Deposit Insurance National Bank (DINB)' },
    aliases: ['DINB'],
    definition: {
      ko: 'FDIC가 부보예금자에게 즉시 접근을 주기 위해 세우는 임시 국법은행. 2023.3.10 DINB of Santa Clara가 설립되어 SVB 부보예금은 3/13 월요일에 접근 가능했고, 무보험분은 3/12 시스템리스크 예외로 보호됐다.',
      en: 'Temporary FDIC-chartered bank that pays insured depositors of a failed bank.',
    },
    cardRef: 'fdic-resolution-weekend',
    sourceRef: 'fdic-pr-16-2023',
  },

  // ───────────── 금리 리스크 ─────────────
  {
    id: 'duration',
    term: { ko: '듀레이션', en: 'Duration' },
    definition: {
      ko: '금리 1%p 변동에 대한 채권 가격의 민감도(연 단위). 듀레이션 6년이면 금리 +100bp에 가격이 약 6% 하락한다. SVB의 HTM 듀레이션은 6.2년이었고 2022.7 순이자이익 헤지를 전량 해제해 노출이 그대로 자본에 전가됐다.',
      en: 'Price sensitivity of a bond to a 1%-point change in yield.',
    },
    cardRef: 'afs-htm-aoci',
    sourceRef: 'fed-svb-review-2023',
  },
  {
    id: 'convexity',
    term: { ko: '볼록성(컨벡시티)', en: 'Convexity' },
    aliases: ['컨벡시티'],
    definition: {
      ko: '금리 변동이 클 때 듀레이션만으로는 설명되지 않는 가격 변화의 2차 효과. 양의 볼록성은 금리 급등 시 손실을 줄이지만, 30년 길트처럼 듀레이션이 긴 자산은 큰 금리 변동에서 가격·담보가치가 비선형으로 움직여 마진콜 규모 추정을 어렵게 한다.',
      en: 'Second-order sensitivity of price to yield; matters for large moves and long-dated collateral.',
    },
  },
  {
    id: 'eve',
    term: { ko: '경제적 자본가치', en: 'Economic Value of Equity (EVE)' },
    aliases: ['EVE', 'ΔEVE'],
    definition: {
      ko: '자산·부채 현금흐름의 현재가치 차이로 본 자본가치. IRRBB 기준(d368)은 평행 상·하, 스티프닝, 플래트닝, 단기 상·하 6개 금리 시나리오로 ΔEVE를 계산하고, ΔEVE가 Tier 1의 15%를 넘으면 이상치(outlier) 은행으로 본다.',
      en: 'Present-value measure of equity under rate shocks; outlier threshold is a 15% of Tier 1 decline.',
    },
    cardRef: 'economic-vs-regulatory-capital',
    sourceRef: 'bcbs-d368',
  },
  {
    id: 'irrbb',
    term: { ko: '은행계정 금리리스크', en: 'Interest Rate Risk in the Banking Book (IRRBB)' },
    aliases: ['IRRBB'],
    definition: {
      ko: '트레이딩이 아닌 은행계정(대출·예금·보유증권)의 금리 변동 리스크. BCBS d368(2016)은 EVE 6개·NII 2개 시나리오와 이상치 기준을 정했고, d578(2024.7)로 2026.1.1부터 충격값이 재보정됐다[현행 값 재확인 필요]. 2023년 위기는 IRRBB가 유동성 리스크로 전환되는 경로를 보여줬다.',
      en: 'Rate risk in non-trading positions; measured through EVE and NII shocks.',
    },
    cardRef: 'afs-htm-aoci',
    sourceRef: 'bcbs-d368',
  },

  // ───────────── 증거금·담보·레포 ─────────────
  {
    id: 'margin-call',
    term: { ko: '마진콜', en: 'Margin call' },
    aliases: ['증거금 추가납부 요구'],
    definition: {
      ko: '파생·레포·대출 포지션의 담보가치가 떨어져 추가 담보를 요구받는 것. 2020.3.20~23 자체헤지 증권사의 ELS 마진콜은 누적 약 5조(사별 8,000억~1조+)로 추정되고, 2022.9 영국 LDI 마진콜은 IMF 추정 약 £70bn, 2021.3.24~25 아케고스 마진콜은 3/25 디폴트로 이어졌다.',
      en: 'Demand for additional collateral when position or collateral values fall.',
    },
    sourceRef: 'imf-wp-2023-210',
  },
  {
    id: 'initial-margin',
    term: { ko: '개시증거금', en: 'Initial Margin (IM)' },
    aliases: ['IM'],
    definition: {
      ko: '포지션 개설 시 미래 손실에 대비해 미리 맡기는 담보. 2020.3 CCP 개시증거금은 +$300bn(+40%) 급증했고 CME E-mini는 $6,600→$12,000으로 올랐다. 비청산 파생의 UMR Phase 6(2022.9.1)은 AANA ≥ €8bn/$8bn 기관에 IM 임계 €50m·ISDA SIMM을 적용한다.',
      en: 'Up-front collateral against potential future exposure; CCP IM rose about $300bn in March 2020.',
    },
    sourceRef: 'fsb-holistic-review-2020',
  },
  {
    id: 'variation-margin',
    term: { ko: '변동증거금', en: 'Variation Margin (VM)' },
    aliases: ['VM'],
    definition: {
      ko: '일일 시가평가 손익을 현금으로 정산하는 증거금. 2020.3.9 하루 변동증거금은 $140bn에 달했고, 아케고스는 CS 스왑 마진이 표준 15~25%가 아닌 6% 미만(2020.9)으로 낮아진 상태에서 변동증거금을 내지 못해 디폴트했다.',
      en: 'Daily cash settlement of mark-to-market changes; $140bn was called on 9 March 2020.',
    },
    sourceRef: 'paul-weiss-cs-archegos-2021',
  },
  {
    id: 'haircut',
    term: { ko: '헤어컷', en: 'Haircut' },
    aliases: ['담보 인정비율 차감'],
    definition: {
      ko: '담보·자산 시장가치에서 차감하는 비율. 시장 관행은 미국 트라이파티 국채 레포 약 2%, IG 회사채 5~10%, 주식 15~25%이며, 한국 증권사 유동성비율은 2027.1.1부터 유동자산에 AA 7%·A 이하 10%·주식 15%·합성 ETF 30% 헤어컷을 적용한다. 스트레스 시 헤어컷 상승은 차입 여력을 자기강화적으로 줄인다.',
      en: 'Discount applied to collateral value; rises in stress and shrinks borrowing capacity.',
    },
    cardRef: 'hqla-and-haircuts',
    sourceRef: 'cgfs-36',
  },
  {
    id: 'repo',
    term: { ko: '환매조건부매매(RP·레포)', en: 'Repurchase agreement (repo)' },
    aliases: ['RP', '레포', '환매조건부채권'],
    definition: {
      ko: '증권을 팔고 나중에 되사는 조건의 담보부 단기 조달. 한국은행은 2020.3.26 무제한 RP(91일, 상한 0.85%)와 2022.10.27 RP 6조 매입·적격담보 확대(최대 36.5조 효과)로 시장을 안정시켰고, 2023.7.10~11 은행 7곳은 새마을금고 국고채·통안채를 6~6.2조 RP로 매입했다.',
      en: 'Collateralised short-term borrowing via sale-and-repurchase; the BOK used RP purchases in 2020, 2022 and (via banks) 2023.',
    },
    cardRef: 'korea-crisis-toolkit',
    sourceRef: 'bok-omo-2022-10-27',
  },
  {
    id: 'tri-party-repo',
    term: { ko: '트라이파티 레포', en: 'Tri-party repo' },
    definition: {
      ko: '청산은행이 담보·현금을 중개하는 레포로, 청산은행이 일중 신용을 제공하고 담보를 요구할 수 있어 2008년 베어스턴스·리먼 실패의 병목이 됐다(FCIC ch.15/18). 미국 트라이파티 헤어컷은 약 2%다.',
      en: 'Repo intermediated by a clearing bank whose intraday credit and collateral calls became the failure mechanism for broker-dealers in 2008.',
    },
    sourceRef: 'fcic-report-2011',
  },
  {
    id: 'trs',
    term: { ko: '총수익스왑', en: 'Total Return Swap (TRS)' },
    aliases: ['TRS'],
    definition: {
      ko: '주식 등을 직접 보유하지 않고 총수익을 주고받는 파생계약으로 공시 없이 레버리지 포지션을 쌓을 수 있다. 아케고스는 2021.3 NAV $36bn 이상으로 복수 프라임브로커에 TRS 총익스포저 $160bn을 쌓아 집중도를 은폐했고, 3/25 디폴트로 CS $5.5bn, 노무라 약 $2.9bn 등 총 $10.4bn 넘는 손실이 났다.',
      en: 'Derivative transferring total return of an asset; Archegos used TRS across brokers to hide $160bn of concentrated exposure.',
    },
    sourceRef: 'sec-pr-2022-70',
  },

  // ───────────── LDI·연기금 ─────────────
  {
    id: 'ldi',
    term: { ko: '부채연계투자', en: 'Liability-Driven Investment (LDI)' },
    aliases: ['LDI'],
    definition: {
      ko: '확정급여형 연기금이 부채의 금리·물가 민감도를 길트·스왑·레포 레버리지로 헤지하는 전략. 영국 LDI가 헤지하는 부채는 약 £1.4tn이며 풀드펀드가 10~15%(약 £200bn)를 차지한다. 2022.9.23~27 30년 길트 +130bp(IMF 140bp)에 담보 콜 스파이럴이 발생해 영란은행이 9/28 임시 매입에 나섰다.',
      en: 'Hedging pension liabilities with leveraged gilt exposure; the 2022 gilt shock triggered collateral-call spirals.',
    },
    sourceRef: 'boe-qb-2023-gilt',
  },
  {
    id: 'hedge-ratio',
    term: { ko: '헤지비율', en: 'Hedge ratio' },
    definition: {
      ko: '부채의 금리 민감도 중 헤지된 비율. 위기 시 헤지비율을 낮추면 담보 부담은 줄지만 금리가 반전하면(2022.9.28 30년 길트 −100bp 이상) 언헤지 손실이 난다. 시나리오의 합성 스킴은 £5bn·레버리지 3배·담보버퍼 약 100bp에서 출발한다.',
      en: 'Share of liability rate sensitivity that is hedged; cutting it in a crisis trades collateral relief for reversal risk.',
    },
  },
  {
    id: 'collateral-buffer',
    term: { ko: '담보버퍼', en: 'Collateral buffer (LDI resilience)' },
    aliases: ['회복력 버퍼', '250bp 버퍼'],
    definition: {
      ko: 'LDI 펀드가 금리 상승에 대비해 미리 보유하는 담보 여력(bp 단위). FPC는 2023.3.29 최소 250bp 회복력을 권고했고, TPR 가이드(2023.4)는 250bp 시장 스트레스 버퍼에 운영 버퍼를 더하며 담보 보충 5일을 가정한다. 업계는 사후 300~400bp를 유지했다.',
      en: 'Yield-shock headroom an LDI fund holds; FPC minimum 250bp plus an operational buffer under TPR guidance.',
    },
    cardRef: 'hqla-and-haircuts',
    sourceRef: 'boe-ldi-staff-paper-2023',
  },

  // ───────────── 한국 증권·보험·상호금융 ─────────────
  {
    id: 'ncr',
    term: { ko: '순자본비율', en: 'Net Capital Ratio (NCR)' },
    aliases: ['NCR'],
    definition: {
      ko: '증권사 건전성 지표로 (영업용순자본 − 총위험액) / 필요유지자기자본이다. 적기시정조치 기준은 100% 미만 권고, 50% 미만 요구, 0% 미만 명령이며, 2022.11.9 매입확약 ABCP 자체매입에는 위험값 32%(기존 100%) 특례가 적용됐다.',
      en: 'Korean broker-dealer capital ratio; PCA at 100/50/0%.',
    },
    cardRef: 'regulator-escalation-ladder',
  },
  {
    id: 'liquidity-ratio-kr',
    term: { ko: '증권사 유동성비율', en: 'Securities-firm liquidity ratio (Korea)' },
    aliases: ['유동성비율', '조정유동성비율'],
    definition: {
      ko: '유동자산/유동부채를 1개월·3개월 기준 각 100% 이상 유지하는 규제. 현행은 종투사 10사·파생결합증권 발행사 13사가 대상이나 2027.1.1부터 49개사 전체로 확대되고, 유동자산에 헤어컷(AA 7%, A 이하 10%, 주식 15%, 합성 ETF 30%)이 적용되며 우발채무가 유동부채에 포함된다. 조정유동성비율은 분모에 채무보증을 더한다.',
      en: 'Korean broker-dealer 1- and 3-month liquidity coverage (100%), broadened with haircuts from 2027.',
    },
    cardRef: 'hqla-and-haircuts',
    sourceRef: 'fsc-86917',
  },
  {
    id: 'pf-abcp',
    term: { ko: 'PF-ABCP', en: 'Project-finance asset-backed commercial paper (PF-ABCP)' },
    aliases: ['ABCP', 'PF 유동화증권'],
    definition: {
      ko: '부동산 PF 대출채권을 기초로 SPC가 발행하는 단기 유동화증권으로, 증권사의 매입확약·신용공여에 의존해 차환된다. 2022.9.29 강원도 보증 아이원제일차 ABCP 2,050억의 미상환이 시장 경색을 촉발했고, 증권사 보증 ABCP 만기는 2022.10 6.2~6.7조, 11월 10.7조였다.',
      en: 'Short-term securitised PF paper rolled on the strength of broker-dealer purchase commitments; the Legoland default froze the market in 2022.',
    },
    cardRef: 'korea-crisis-toolkit',
    sourceRef: 'kcmi-lee-2022-18',
  },
  {
    id: 'purchase-commitment',
    term: { ko: '매입확약', en: 'Purchase commitment (ABCP backstop)' },
    aliases: ['매입약정', '채무보증', '신용공여'],
    definition: {
      ko: '유동화증권이 차환되지 않을 때 증권사가 이를 사 주기로 한 약정. 차환 실패 시 자체매입으로 NCR과 유동성이 동시에 소진되며, 2022년 증권사 PF 채무보증은 20.2조(10월말)→21.5조(12월말), 익스포저/자기자본은 중형사 47%·소형사 49%였다. 2023.5 금융위는 4.9조를 대출로 전환하도록 했다.',
      en: 'Broker-dealer commitment to buy unrolled ABCP; converts refinancing failure into a capital and liquidity hit.',
    },
    cardRef: 'korea-crisis-toolkit',
    sourceRef: 'fsc-80034',
  },
  {
    id: 'bond-stabilization-fund',
    term: { ko: '채권시장안정펀드', en: 'Bond Market Stabilization Fund' },
    aliases: ['채안펀드'],
    definition: {
      ko: '금융회사들이 캐피탈콜 방식으로 출자해 회사채·CP를 매입하는 시장안정 기금으로 상설 기금이 아니다. 2008.12 5조 → 2020.3 20조(1차 콜 3조) → 2022.10 50조+α → 2024.5 약 94조 → 2025.12 "100조+α"로 확대됐고, 2022.10.24 CP 매입을 개시했다.',
      en: 'Capital-call fund of financial firms buying corporate bonds and CP in stress; not a standing fund.',
    },
    cardRef: 'korea-crisis-toolkit',
    sourceRef: 'fsc-78804',
  },
  {
    id: 'stock-stabilization-fund',
    term: { ko: '증권시장안정펀드', en: 'Stock Market Stabilization Fund' },
    aliases: ['증안펀드'],
    definition: {
      ko: '주식시장 급락 시 매입에 나서도록 조성되는 기금. 2020.4 10.7조로 조성됐고 2024.12·2025.4·2026.3 가동 준비가 발표됐으나 실집행은 확인되지 않았다[미확인].',
      en: 'Standby equity-purchase fund (KRW 10.7tn in 2020); actual deployment unconfirmed.',
    },
    cardRef: 'korea-crisis-toolkit',
  },
  {
    id: 'k-ics',
    term: { ko: '신지급여력비율', en: 'Korean Insurance Capital Standard (K-ICS)' },
    aliases: ['K-ICS', '킥스'],
    definition: {
      ko: '보험회사의 시가 기반 지급여력 비율. 법정 100%, 감독 권고는 150%에서 2025년 130%로 낮아졌고, 2027.1.1부터 기본자본 K-ICS 50%(경과 9년)가 시행된다.',
      en: 'Market-consistent solvency ratio for Korean insurers; 100% legal minimum, 130% supervisory guide, 50% core-capital ratio from 2027.',
    },
    cardRef: 'korea-crisis-toolkit',
    sourceRef: 'fsc-86032',
  },
  {
    id: 'deposit-insurance-limit',
    term: { ko: '예금자보호한도', en: 'Deposit insurance limit' },
    aliases: ['예금보호한도', '1억원 한도'],
    definition: {
      ko: '예금보험공사가 1인당 금융회사별로 보호하는 원리금 상한. 2001년 2천만→5천만원이 된 뒤 24년 만인 2025.9.1 1억원으로 올랐고, DC/IRP·연금저축·사고보험금은 각각 별도 1억원이다. 새마을금고·농협·수협·신협·산림조합은 예보가 아닌 각 중앙회 기금이 보호한다.',
      en: 'KRW 100m per depositor per institution since 1 September 2025; mutual credit sectors are covered by their own central funds.',
    },
    cardRef: 'uninsured-deposits-and-run-speed',
    sourceRef: 'korea-kr-deposit-limit-2025',
  },
  {
    id: 'prompt-corrective-action',
    term: { ko: '적기시정조치', en: 'Prompt Corrective Action (PCA)' },
    aliases: ['PCA', '경영개선권고', '경영개선요구', '경영개선명령'],
    definition: {
      ko: '건전성 지표가 기준을 밑돌면 당국이 권고→요구→명령 순으로 개입하는 제도(금산법). 증권사 NCR 100/50/0%, 저축은행 BIS 7%(자산 1조 이상 8%) 등이 문턱이며, 2011.2.17 부산·대전저축은행 영업정지, 2024.12 안국·라온 권고, 2025.6 상상인플러스 요구가 사례다. 미국 PCA는 FDIC OIG의 시그니처 사후평가 대상이었다.',
      en: 'Graduated mandatory supervisory intervention (recommend, require, order) when capital or liquidity ratios breach thresholds.',
    },
    cardRef: 'regulator-escalation-ladder',
    sourceRef: 'fsc-69869',
  },
  {
    id: 'bok-act-article-65',
    term: {
      ko: '한국은행법 제65조 긴급여신',
      en: 'Bank of Korea Act Article 65 (emergency lending)',
    },
    aliases: ['한은법 65조', '긴급여신'],
    definition: {
      ko: '유동성이 악화된 금융기관에 한국은행이 임시 적격담보로 대출할 수 있게 하는 조항으로, 금융통화위원회 위원 4명 이상 찬성과 정부 의견 청취가 요건이다. 제80조는 비은행 영리기업 여신(4명 이상), 제68조는 공개시장운영(RP 매입·적격담보 확대)의 근거다.',
      en: 'Statutory basis for BOK emergency lending against temporary collateral; requires four MPC votes and government consultation.',
    },
    cardRef: 'korea-crisis-toolkit',
    sourceRef: 'bok-act',
  },
  {
    id: 'f4-meeting',
    term: { ko: 'F4 회의', en: 'F4 meeting (macro-financial coordination)' },
    aliases: ['거시경제금융회의', '비상거시경제금융회의'],
    definition: {
      ko: '재정경제부·한국은행·금융위원회·금융감독원 수장이 모이는 위기 조율 회의. 절차는 금융위 (긴급)금융시장점검회의 → F4 → Contingency Plan 순이며, 2024.12.4 계엄 직후 "유동성 무제한 공급"을 발표하고 12/6~16 매일 열렸다.',
      en: 'Four-agency (MOEF, BOK, FSC, FSS) crisis coordination meeting.',
    },
    cardRef: 'korea-crisis-toolkit',
  },
  {
    id: 'fx-swap-line',
    term: { ko: '통화스와프', en: 'Central-bank FX swap line' },
    aliases: ['한미 통화스와프', '스와프라인'],
    definition: {
      ko: '중앙은행 간 자국통화와 달러를 교환해 달러 유동성을 공급하는 협정. 2020.3.19 한미 600억달러 통화스와프가 체결됐고, 3/31 1차 입찰(120억 공급, 87.2억 낙찰)부터 6회 총 198.72억달러가 공급된 뒤 7/30 전액 상환됐다.',
      en: 'Reciprocal currency arrangement between central banks; Korea drew USD 19.9bn of the 2020 USD 60bn Fed line.',
    },
    cardRef: 'korea-crisis-toolkit',
  },
  {
    id: 'usable-fx-reserves',
    term: { ko: '가용외환보유액', en: 'Usable FX reserves' },
    aliases: ['가용보유액'],
    definition: {
      ko: '총외환보유액에서 즉시 쓸 수 없는 예치금 등을 뺀 실제 동원 가능 외화. 1997년 총보유액은 12월말 207억달러였지만 가용보유액은 12월 39억달러까지 떨어졌고(일자 미확인), 11/5 "20억달러" 보도가 위기를 가속했다. 10~11월 환율방어에 약 151억달러가 소진됐다[해외자료].',
      en: 'Reserves actually deployable; Korea fell to about USD 3.9bn usable in December 1997.',
    },
    sourceRef: 'audit-fx-crisis-1998',
  },
  {
    id: 'short-term-external-debt',
    term: { ko: '단기외채', en: 'Short-term external debt' },
    definition: {
      ko: '만기 1년 이하 대외채무. 1997년말 외채 약 1,530억달러 중 단기 비중은 58.8%[해외자료]였고, 1998.1.28 뉴욕 외채협상으로 단기외채 약 240억달러가 정부보증 1·2·3년물(LIBOR+2.25/2.50/2.75%)로 전환됐다(3/31 최종 218.4억). 가용보유액/단기외채가 게임의 Guidotti 비율이다.',
      en: 'External debt maturing within a year; the 1998 New York rollover converted about USD 24bn into government-guaranteed 1-3 year paper.',
    },
    sourceRef: 'audit-fx-crisis-1998',
  },
  {
    id: 'capital-controls',
    term: { ko: '자본통제', en: 'Capital controls' },
    definition: {
      ko: '자본 유출입을 행정적으로 제한하는 조치. 1998.9.1 말레이시아는 자본통제와 링깃 3.80 페그를 택했고, 한국은 IMF 프로그램 아래 1997.12.16 환율변동폭 폐지·외국인 주식한도 확대(12/12 50%, 12/30 55%)로 반대 방향을 갔다. 시나리오에서 말레이시아는 대조군으로 쓰인다.',
      en: 'Administrative limits on capital flows; Malaysia 1998 is the counterfactual to the Korea IMF path.',
    },
  },

  // ───────────── 시장 스트레스 지표 ─────────────
  {
    id: 'cds',
    term: { ko: '신용부도스왑', en: 'Credit Default Swap (CDS)' },
    aliases: ['CDS', 'CDS 프리미엄'],
    definition: {
      ko: '준거 기관의 부도 위험을 거래하는 파생상품으로 프리미엄(bp)이 시장의 신용 평가다. 크레디트스위스 5년 CDS는 2022.9 약 250bp에서 2023.3.15 1,000bp를 넘었고, 한국 국가 CDS 5년은 2022.11.4 75.61bp였다. 게임은 CDS 역전 또는 1,000bp 초과 시 무담보 라인을 차단한다.',
      en: 'Market price of default protection; CS 5-year CDS passed 1,000bp on 15 March 2023.',
    },
    sourceRef: 'finma-cs-report-2023',
  },
  {
    id: 'ted-spread',
    term: { ko: 'TED 스프레드', en: 'TED spread' },
    definition: {
      ko: '3개월 은행 간 금리(LIBOR)와 미 재무부 단기채 금리의 차이로 은행 간 신용 불안을 재는 지표. 2008.10.10 4.58%로 정점을 찍었다.',
      en: 'Gap between 3-month LIBOR and T-bills; peaked at 4.58% on 10 October 2008.',
    },
    sourceRef: 'fcic-report-2011',
  },
  {
    id: 'libor-ois',
    term: { ko: 'LIBOR-OIS 스프레드', en: 'LIBOR-OIS spread' },
    definition: {
      ko: '무담보 은행 간 금리와 OIS(정책금리 기대)의 차이로 자금시장 스트레스를 재는 지표. 2008.10.10 약 364bp[2차]로 인용되며 1차 출처 재확인이 필요하다. BTFP 금리(1년 OIS+10bp)처럼 OIS는 정책 창구의 기준금리로도 쓰인다.',
      en: 'Unsecured-versus-OIS funding stress gauge; the oft-cited 364bp (Oct 2008) is a secondary-source figure.',
    },
  },
  {
    id: 'vix',
    term: { ko: 'VIX(변동성지수)', en: 'VIX' },
    definition: {
      ko: 'S&P 500 옵션 내재변동성 지수. 2020.3.16 82.69로 사상 최고를 기록했고, 연준 스트레스테스트 심각 시나리오는 2025년 65, 2026년 72를 가정한다.',
      en: 'S&P 500 implied-volatility index; record 82.69 on 16 March 2020.',
    },
    sourceRef: 'fed-stress-scenarios-2026',
  },
  {
    id: 'circuit-breaker',
    term: { ko: '서킷브레이커', en: 'Circuit breaker' },
    aliases: ['매매거래 중단'],
    definition: {
      ko: '지수가 일정 폭 이상 급락하면 거래를 일시 중단하는 장치. 2020년 3월 미국은 3/9(S&P −7.6%), 3/12, 3/16(S&P −11.98%), 3/18 네 차례 발동됐다.',
      en: 'Automatic trading halt after a threshold decline; triggered four times in March 2020.',
    },
    sourceRef: 'fsb-holistic-review-2020',
  },

  // ───────────── 펀드·MMF ─────────────
  {
    id: 'mmf',
    term: { ko: '머니마켓펀드', en: 'Money Market Fund (MMF)' },
    aliases: ['MMF'],
    definition: {
      ko: '단기 채권·CP에 투자해 안정 NAV를 추구하는 펀드. 2008.9.16 Reserve Primary Fund($62.5B)는 리먼 CP $785M 손실로 NAV $0.97("breaking the buck")을 기록해 이틀간 $40B+ 환매를 맞았고, 2020.3 기관 프라임 MMF는 3주 내 약 $100bn(16%)이 유출됐다. SEC 2023 개혁은 DLA 25%·WLA 50%를 요구한다.',
      en: 'Stable-NAV short-term fund; runs in 2008 and 2020 drove the 2023 SEC reforms.',
    },
    sourceRef: 'sec-mmf-reforms-2023',
  },
  {
    id: 'gate',
    term: { ko: '환매 게이트', en: 'Redemption gate' },
    aliases: ['게이트', '환매 제한'],
    definition: {
      ko: '펀드가 환매를 일시 제한하는 장치. 2020.3 프라임 MMF의 주간유동자산(WLA) 30% 게이트 문턱은 투자자가 게이트 전에 빠져나가는 선제 런을 유발했고, SEC 2023 개혁은 게이트를 폐지하고 일일 순환매 5% 초과 시 의무 유동성 수수료로 대체했다.',
      en: 'Temporary suspension of redemptions; abolished for US MMFs in 2023 because the threshold itself triggered pre-emptive runs.',
    },
    sourceRef: 'sec-mmf-reforms-2023',
  },
  {
    id: 'swing-pricing',
    term: { ko: '스윙프라이싱', en: 'Swing pricing' },
    definition: {
      ko: '대량 환매·설정 시 거래비용을 NAV에 반영해 잔류 투자자의 희석을 막는 가격 조정. FSB의 개방형 펀드 권고(2023.12)는 게이트보다 이런 희석방지 도구를 우선하며, 2020.3 회사채 유동성 비용은 30→90bp, 블록 거래는 24→150bp+로 뛰었다.',
      en: 'Adjusting NAV for the transaction costs imposed by large flows so that remaining investors are not diluted.',
    },
    sourceRef: 'fsb-holistic-review-2020',
  },

  // ───────────── 스트레스테스트 ─────────────
  {
    id: 'stress-test',
    term: { ko: '스트레스테스트', en: 'Stress test' },
    definition: {
      ko: '가상의 심각한 시나리오에서 자본·유동성이 버티는지 보는 검사. 연준 2026 심각 시나리오는 실질 GDP −4.6%, 실업률 10%, 주택 −30%, CRE −39%, 주가 −58%, VIX 72이며 EBA 2025는 GDP −6.3% 누적, BoE 2025는 인플레형(기준금리 8%, CPI 10%)이다. 한국은 금감원 STARS-I(2017.12)와 한은 SAMP(2012.9)를 운영한다.',
      en: 'Forward-looking capital/liquidity test under severe scenarios; the platform offers both deflationary (Fed) and inflationary (BoE) regimes.',
    },
    sourceRef: 'fed-stress-scenarios-2026',
  },
  {
    id: 'ccar',
    term: { ko: '종합자본분석검토', en: 'Comprehensive Capital Analysis and Review (CCAR)' },
    aliases: ['CCAR', 'DFAST'],
    definition: {
      ko: '연준이 대형 은행지주의 자본계획을 감독 시나리오로 검토하는 연례 절차로, Dodd-Frank 스트레스테스트(DFAST)와 같은 시나리오를 쓴다. 매년 2월 발표되는 심각 시나리오(2026: 2/4)가 게임의 거시 변수 보정 기준이다.',
      en: 'Annual Fed review of large bank holding companies capital plans using the supervisory stress scenarios.',
    },
    sourceRef: 'fed-stress-scenarios-2026',
  },
]

export const GLOSSARY_IDS: ReadonlySet<string> = new Set(GLOSSARY.map((g) => g.id))
