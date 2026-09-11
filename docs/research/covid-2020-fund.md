# 2020년 3월 코로나 '현금 확보 쇄도'(dash for cash) (covid-2020-fund)

> 원 출처: 구현 계획서 부록 B-2.
> 원 요청 대비 수정: 2020년 3월 베이시스 트레이드 "$1T+"는 2023~24 추정치(2020년 2월은 ≈$664B).

## 역할 / 기관
- 플레이어 역할: 채권펀드 PM(Portfolio Manager)
- 대안 역할: 기업 재무담당(Corporate Treasurer)
- 등장 기관: 연준(Federal Reserve), 미 재무부, SEC, FSB(Financial Stability Board), CCP(Central Counterparty, 중앙청산소; CME 등), 프라임 MMF(Money Market Fund), 회사채 ETF(LQD), 한국은행(통화스와프 상대)

## 타임라인(검증)
| 일자 | 사건 |
|---|---|
| 3/3 | 연준 긴급 50bp 인하 |
| 3/9 | 첫 서킷브레이커, S&P −7.6%, 미 10년 0.54% 저점 |
| 3/12 | 2차 서킷브레이커, LQD NAV 대비 ~−5%(최대 −5.35%) |
| 3/15 | 기준금리 0~0.25% + 국채 ≥$500bn·MBS ≥$200bn 매입 |
| **3/16** | 3차 서킷브레이커, S&P −11.98%, VIX 82.69 사상 최고 |
| 3/17 | CPFF(Commercial Paper Funding Facility)·PDCF(Primary Dealer Credit Facility) |
| 3/18 | MMLF(Money Market Mutual Fund Liquidity Facility), 4차 서킷브레이커, 10년 1.18%(국채-주식 동반 매도, 베이시스 트레이드 청산) |
| 3/19 | 9개국 통화스와프(한국 $60bn) |
| 3/23 | 무제한 QE + PMCCF/SMCCF/TALF; IG/HY 스프레드 정점 |
| 3/31 | FIMA 레포(Foreign and International Monetary Authorities Repo Facility) |
| 4/9 | 최대 $2.3tn(Main Street $600bn, 회사채 프로그램 $850bn, MLF(Municipal Liquidity Facility) $500bn, 추락천사(fallen angel) HY 포함) |
| 4/20 | WTI 5월물 −$37.63 |

## 핵심 정량지표
| 구분 | 지표 | 값 | 검증 |
|---|---|---|---|
| 유동성 | IG 거래비용 | 30→90bp | ✔ |
| 유동성 | 블록 거래비용 | 24→150bp+ | ✔ |
| 펀드 유출 | 채권 뮤추얼펀드 3월 유출 | >$250bn(~5% AUM) | ✔ |
| 펀드 유출 | 회사채 펀드+ETF 2주 | $174bn | ✔ |
| 펀드 유출 | 기관 프라임 MMF(3/6~26) | ≈$100bn(3주 내 16% AUM) | ✔ |
| 기업 | 리볼버(revolver) 인출(3~4월) | $284bn(IG 과반) | ✔ |
| 레버리지 | 베이시스 트레이드(2월) | ≈$664bn, 3월 −$127bn | ✔ |
| 마진 | CCP 개시증거금(IM) | +$300bn(+40%) | ✔ |
| 마진 | 3/9 변동증거금(VM) | $140bn | ✔ |
| 마진 | CME E-mini IM | $6,600→$12,000 | ✔ |
| 발행 | 3/23 이후 IG 발행(~5/20) | $625bn | ✔ |
| 스프레드 | IG OAS 정점 | ~373bp(Bloomberg) / ~401bp(ICE) | △ |
| 스프레드 | HY 정점 | ~1,100bp | [미확인] |
| ETF | LQD NAV 괴리 | −5.35%(2020.3) | ✔ |
| 시장 | VIX(3/16) | 82.69(사상 최고) | ✔ |
| 시장 | S&P(3/16) | −11.98% | ✔ |
| 시장 | 미 10년 | 0.54%(3/9) → 1.18%(3/18) | ✔ |

## 의사결정 지점
1. **기업 재무: 리볼버 인출 여부** — 은행 B/S 압박·신호 효과 vs 접근 상실
2. **자산운용: 환매 충당 매도 순서** — 유동성 있는 것 먼저 vs 비례; 스윙프라이싱(swing pricing)·희석방지
3. **프라임 MMF: 30% WLA(Weekly Liquid Assets) 게이트 접근** — 선제 런 유발
4. **베이시스 트레이더: 청산 vs 유지**
5. **개방형 펀드(OEF, Open-Ended Fund) 게이트**

## 교훈 및 공식 사후평가 출처
- **FSB Holistic Review 2020**
- **Fed FSR(Financial Stability Report) 2020.5**
- **FEDS Note 2020.10**
- **BCBS-CPMI-IOSCO 마진 검토(d526)**
- **SEC 2023 MMF 개혁**: 게이트 폐지, DLA 25%/WLA 50%, 일일 순환매 >5% 시 의무 유동성 수수료
- **FSB OEF 2023.12**: 희석방지 도구 우선

## 미확인 항목 (구현 시 재검증)
- HY 스프레드 정점 ~1,100bp [미확인]
- IG OAS 정점 ~373bp(Bloomberg)/~401bp(ICE) — 출처별 상이(계획서 정확성 리뷰 항목: "IG OAS 373bp")
- 베이시스 트레이드 규모: 2020.2 ≈$664B 사용, "$1T+"는 2023~24 추정치이므로 미사용

## 출처
- FSB, Holistic Review of the March Market Turmoil(2020)
- Federal Reserve, Financial Stability Report(2020.5)
- FEDS Notes(2020.10)
- BCBS-CPMI-IOSCO, Review of margining practices(d526)
- SEC, Money Market Fund Reforms(2023)
- FSB, Open-Ended Funds 권고(2023.12)
- Bloomberg / ICE 지수(IG OAS)
