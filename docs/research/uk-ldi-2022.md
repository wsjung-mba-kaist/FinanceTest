# 2022 영국 LDI·길트 위기 (uk-ldi-2022)

> 원 출처: 구현 계획서 부록 B-1.
> 원 요청 대비 수정: 30년 길트 "3.5%" 시작점은 9월 초 수준(9/22는 ~3.7%).

## 역할 / 기관
- 플레이어 역할: DB(Defined Benefit, 확정급여형) 연기금 CIO(Chief Investment Officer)
- 대안 역할: LDI(Liability-Driven Investment, 부채연계투자) 운용역
- 등장 기관: BoE(Bank of England, 영란은행), FPC(Financial Policy Committee, 금융정책위원회), APF(Asset Purchase Facility, 자산매입기금), TPR(The Pensions Regulator, 연금규제청), 영국 재무부, IMF, LDI 풀드펀드(pooled fund) 운용사

## 타임라인(검증)
| 일자 | 사건 |
|---|---|
| 9/22 | BoE 50bp 인상(2.25%), APF 길트(gilt) 매각 확정 |
| 9/23 | 미니예산(mini-budget) 발표 |
| **9/23~27** | 30년 길트 +130bp(3거래일; IMF는 140bp); 한 주에 35bp 초과 일일 상승 2회(2000년 이후 최대는 29bp) |
| 9/28 | FPC 권고, BoE 20년 초과 길트 임시매입(회당 £5bn, 13회, 최대 £65bn, ~10/14); 당일 30년 −100bp 이상 |
| 10/10 | 담보 확대 레포(TECRF, Temporary Expanded Collateral Repo Facility), 회당 £10bn |
| 10/11 | 물가연동채(index-linked gilt) 매입 포함; 30년 호가 스프레드 0.5→2.5bp |
| 10/14 | 예정대로 종료, **총 매입 £19.3bn**(명목 12.1 + 연동 7.2); 30년 다시 5% 초과; 재무장관 교체 |
| 11/29~1/12 | £19.3bn 재매각 |
| 2023.3.29 | FPC **250bp 최소 회복력 기준** |
| 2023.4 | TPR 가이드(250bp + 운영 버퍼, 담보 보충 5일 가정) |

## 핵심 정량지표
| 지표 | 값 | 출처 |
|---|---|---|
| 13일간 LDI 펀드 담보 조달 | >£40bn | Breeden |
| 13일간 길트 매도 | >£30bn | Breeden |
| 마진콜 추정 | ≈£70bn | IMF |
| 길트 매도 추정 | ≈£37bn | IMF |
| LDI 헤지 부채 | ≈£1.4tn | |
| 풀드펀드 비중 | 10~15%(~£200bn) | |
| 30년 길트 변동(8/1→10/14) | +270bp | |
| 30년 길트 변동(9/23~27) | +130bp(IMF 140bp) | |
| 30년 길트 변동(9/28) | −100bp 이상 | |
| BoE 임시매입 한도 / 실집행 | 최대 £65bn(회당 £5bn, 13회) / £19.3bn | |
| 사후 버퍼(업계) | 300~400bp | |
| FPC 최소 회복력 기준 | 250bp(2023.3.29) | |
| TPR 가이드 | 250bp + 운영 버퍼, 담보 보충 5일 가정(2023.4) | |

## 의사결정 지점
1. **담보 콜 충당 수단** — 길트 매도(→ 스파이럴) / 주식·크레딧 매도(T+2) / 스킴(scheme) 현금 / 스폰서(sponsor) 출연
2. **헤지비율 축소 vs 유지** — 9/28 −100bp 반전 시 언헤지 손실
3. **담보 보충 운영 속도** — 구속 제약은 지급능력이 아닌 '일수'
4. **사후 버퍼 목표** — 250bp(FPC/TPR) vs 업계 300~400bp

## 교훈 및 공식 사후평가 출처
- BoE 스태프 페이퍼(LDI 최소 회복력)
- FPC 2022.12
- BoE Quarterly Bulletin 2023 케이스스터디
- Breeden 2022.11 연설
- TPR 2023.4 가이드
- IMF WP 2023/210

## 미확인 항목 (구현 시 재검증)
- 9/22·9/28 30년 길트 정확 수준(~3.7%→~5.1% 근사)
- 풀드펀드 레버리지 배수
- 30년 길트 시작점: 9월 초 ~3.5% vs 9/22 ~3.7% — 게임 시작 시점에 따라 값 선택 필요

## 출처
- Bank of England, 스태프 페이퍼(LDI minimum resilience)
- FPC Record / Financial Stability Report(2022.12)
- Bank of England Quarterly Bulletin(2023), LDI 케이스스터디
- Breeden, S., 연설(2022.11)
- The Pensions Regulator, LDI 가이드(2023.4)
- IMF Working Paper 2023/210
