# 2021 아케고스(Archegos) 사태 (archegos-2021)

> 원 출처: 구현 계획서 부록 B-3.

## 역할 / 기관
- 플레이어 역할: 프라임브로커(Prime Broker, PB) 리스크 헤드
- 등장 기관: 아케고스 캐피털(Archegos Capital Management), CS(Credit Suisse), 노무라(Nomura), MS(Morgan Stanley), GS(Goldman Sachs), UBS, ViacomCBS, Paul Weiss(CS 외부 조사), SEC/DOJ, Fed/PRA/FINMA

## 타임라인(검증)
| 일자 | 사건 |
|---|---|
| 2019 | CS 스왑 마진 ~20%→7.5% |
| 2020.4 | CS PE(Potential Exposure) 한도 $20m 10배 초과 |
| 2020.8 | PE $530m — 디리스킹 없음 |
| 2020.9 | CS 스왑 마진 <6%(표준 15~25%) |
| 2021.3 | 정점 NAV >$36bn, 총익스포저 $160bn(TRS(Total Return Swap), 복수 PB, 집중도 은폐) |
| 3/22 | ViacomCBS $3bn 증자 발표 |
| 3/24~25 | 마진콜 |
| **3/25** | 디폴트; MS 당일 밤 ~$5bn 매도 |
| 3/26 | GS ~$10.5bn 블록 매도, 총 ~$19~20bn |
| 3/29 | 노무라·CS 손실 경고 |
| 7/29 | Paul Weiss 보고서(23명 징계, $70m 환수) |
| 11월 | CS 프라임 서비스 철수 |
| 2022.4.27 | SEC/DOJ 기소 |
| 2023.7.24 | Fed $268.5m, PRA £87m, FINMA 시정조치 |

## 핵심 정량지표
| 지표 | 값 |
|---|---|
| CS 스왑 마진 | ~20%(2019 이전) → 7.5%(2019) → <6%(2020.9); 표준 15~25% |
| CS PE 한도 / 실제 | $20m / 10배 초과(2020.4), $530m(2020.8) |
| 정점 NAV | >$36bn(2021.3) |
| 총익스포저 | $160bn(TRS, 복수 PB) |
| 3/25~26 청산 규모 | MS ~$5bn + GS ~$10.5bn 블록, 총 ~$19~20bn |
| 손실 | **CS $5.5bn, 노무라 ~$2.9bn, MS $911m, UBS $774m, 총 >$10.4bn** |
| 제재 | Fed $268.5m, PRA £87m, FINMA 시정(2023.7.24) |
| CS 내부 징계 | 23명, $70m 환수(Paul Weiss 2021.7.29) |

## 의사결정 지점
1. **마진 조건** — 정적(static) vs 동적(dynamic) + 집중도 가산
2. **한도 초과 대응** — 에스컬레이션 vs 최우수 고객 수용(5개월 유예)
3. **카운터파티 투명성** — 타 PB 노출 집계 요구 vs 상한
4. **3/25 죄수의 딜레마** — 질서 있는 청산 조율 vs 선매도: GS/MS 선매도 → 손실 미미, CS/노무라 대기 → 대손실
5. **프라임브로커리지 잔류 여부** — CS 11월 철수

## 교훈 및 공식 사후평가 출처
- **Paul Weiss 2021.7.29**: "경영·통제의 근본적 실패"
- **Fed/PRA/FINMA 2023 제재**
- **SEC PR 2022-70**
- **FSB NBFI(Non-Bank Financial Intermediation) 레버리지** 보고
- **BdE(Banco de España) FSR 41**

## 미확인 항목 (구현 시 재검증)
- 부록 B-3에 명시적 [미확인]·[2차] 표기 항목은 없음
- 근사치(~) 표기 항목(MS ~$5bn, GS ~$10.5bn, 총 ~$19~20bn, 노무라 ~$2.9bn, 마진 ~20%)은 게임 데이터 사용 시 1차 출처 수치로 고정 필요

## 출처
- Paul, Weiss, Rifkind, Wharton & Garrison LLP, Credit Suisse Archegos 조사 보고서(2021.7.29)
- Federal Reserve Board 제재 발표(2023.7.24), PRA 제재, FINMA 시정조치
- SEC Press Release 2022-70(2022.4.27), DOJ 기소
- FSB, NBFI 레버리지 관련 보고
- Banco de España, Financial Stability Review 41
