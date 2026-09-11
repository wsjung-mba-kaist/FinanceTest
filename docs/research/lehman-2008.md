# 2008 글로벌 금융위기(GFC) 뱅크런 국면 — 노던록·베어스턴스·리먼·AIG (lehman-2008)

> 원 출처: 구현 계획서 부록 C-2.

## 역할 / 기관
- 플레이어 역할: 투자은행(IB, Investment Bank) Treasurer(자금담당)
- 대안 역할: 연준(Federal Reserve)·재무부(U.S. Treasury) 정책담당
- 등장 기관: 노던록(Northern Rock), BoE(Bank of England, 영란은행), 베어스턴스(Bear Stearns), JPM(JPMorgan), FRBNY(뉴욕연준), 리먼브라더스(Lehman Brothers), KDB(한국산업은행), 씨티(Citi), BofA(Bank of America), 메릴린치(Merrill Lynch), 바클레이스(Barclays), FSA(UK Financial Services Authority), AIG, Reserve Primary Fund

## 타임라인(검증)

### 2007~2008.2: 노던록
| 일자 | 사건 |
|---|---|
| 2007.9.14 | BoE 노던록 유동성 지원 발표 → 며칠 내 £4.6B 인출 |
| 9/17 | 정부 보증; BoE 대출 정점 £28.5B |
| 2008.2 | 국유화 |

### 2008.3: 베어스턴스
| 일자 | 사건 |
|---|---|
| 2008.3.10~13 | 레포(repo) 롤오버 거부·헤지펀드 노베이션(novation) |
| 3/13 | "내일 결제 불가" 통보(유동성 풀 $18B→$2B[미확인]) |
| 3/14 | FRBNY, JPM 경유 $12.9B 비소구(non-recourse) 대출(담보 $13.8B) |
| 3/16 | JPM $2/주 인수, 연준 $30B 자산 금융, PDCF(Primary Dealer Credit Facility) 발표 |
| 3/24 | $10/주로 수정, Maiden Lane($29B FRBNY + $1B JPM) |

### 2008.9~11: 리먼·AIG·MMF·시스템 대응
| 일자 | 사건 |
|---|---|
| 9/9~12 | 리먼: KDB 협상 결렬, JPM·씨티·BofA 추가 담보 요구, 트라이파티 레포(tri-party repo)가 병목 |
| 9/13~14 | BofA→메릴 인수; 바클레이스 인수는 FSA의 주주투표 면제 거부로 무산; PDCF 담보 확대(지주에는 대출 불가) |
| **9/15 01:30** | 리먼 Chapter 11 신청(자산 ~$639B[2차], 자본 ~$20B, 부채 ~$100B) |
| 9/16 | AIG $85B(2년, LIBOR+850bp, 지분 79.9%); Reserve Primary Fund($62.5B, 리먼 CP $785M) NAV $0.97("breaking the buck"), 이틀간 $40B+ 환매 |
| 9/19 | 재무부 MMF(Money Market Fund) 보증, AMLF |
| 10/3 | TARP $700B(CPP $250B) |
| 10/7 | CPFF(Commercial Paper Funding Facility) |
| **10/10** | TED 스프레드 4.58%, LIBOR-OIS ~364bp[2차] |
| 10/14 | TLGP(Temporary Liquidity Guarantee Program; 선순위 무담보 보증, 채무의 125%, 수수료 ≤100bp) |
| 11/10 | AIG $60B로 조정, ML II/III(Maiden Lane II/III) |

## 핵심 정량지표
| 구분 | 지표 | 값 | 검증 |
|---|---|---|---|
| 노던록 | 발표 후 인출 | £4.6B(며칠 내) | ✔ |
| 노던록 | BoE 대출 정점 | £28.5B | ✔ |
| 베어스턴스 | 유동성 풀 | $18B→$2B | [미확인] |
| 베어스턴스 | FRBNY 비소구 대출 / 담보 | $12.9B / $13.8B | ✔ |
| 베어스턴스 | 인수가 | $2/주 → $10/주 | ✔ |
| 베어스턴스 | 연준 자산 금융 / Maiden Lane | $30B / $29B FRBNY + $1B JPM | ✔ |
| 리먼 | 자산 / 자본 / 부채 | ~$639B[2차] / ~$20B / ~$100B | △ |
| AIG | 대출 | $85B(2년, LIBOR+850bp, 지분 79.9%) → 11/10 $60B | ✔ |
| Reserve Primary Fund | 규모 / 리먼 CP / NAV / 환매 | $62.5B / $785M / $0.97 / 이틀간 $40B+ | ✔ |
| TARP | 규모 | $700B(CPP $250B) | ✔ |
| 시장 스트레스 | TED 스프레드(10/10) | 4.58% | ✔ |
| 시장 스트레스 | LIBOR-OIS | ~364bp | [2차] |
| TLGP | 보증 범위 / 수수료 | 채무의 125% / ≤100bp | ✔ |

## 의사결정 지점
1. **노던록: 비공개 vs 공개 LOLR(Lender of Last Resort)** — 공개 발표가 줄서기 촉발, 전면 보증으로만 종료
2. **베어: 브릿지론 vs 파산, 매각가($2→$10)**
3. **리먼 주말: 민간 컨소시엄 vs 연준 보증** — FSA 면제 거부·연준 담보 부족 주장 vs Ball의 반론
4. **AIG 대출 vs 파산**
5. **MMF 중단 vs 보증** — 기관별 대출은 런을 못 막고 시스템 보증이 막음

## 교훈 및 공식 사후평가 출처
- **FCIC(Financial Crisis Inquiry Commission) ch.15/18**: 트라이파티 레포 일중 신용·청산은행 담보 요구가 증권사 실패 메커니즘
- **FDIC Quarterly 2011**: 리먼 무질서 파산 → Title II OLA(Orderly Liquidation Authority)
- **BoE 2007**: 보증 없는 LOLR 발표는 런 촉발 → SRR(Special Resolution Regime) 창설
- **Fed History**

## 미확인 항목 (구현 시 재검증)
- 베어스턴스 유동성 풀 $18B→$2B [미확인] (계획서 정확성 리뷰 항목: "베어 유동성 풀 일별")
- 리먼 자산 ~$639B [2차]
- LIBOR-OIS ~364bp [2차] (계획서 정확성 리뷰 항목)

## 출처
- FCIC, The Financial Crisis Inquiry Report(2011) ch.15, ch.18
- FDIC Quarterly(2011), 리먼 사례와 Title II OLA
- BoE, 노던록 관련 2007 자료 및 SRR 창설 배경
- Federal Reserve History(베어스턴스·리먼·AIG·PDCF·CPFF·AMLF·TARP·TLGP 항목)
- Ball, L. — 리먼 연준 담보 부족 주장에 대한 반론
- [2차]·[미확인] 표기 수치: 2차 출처 또는 미검증
