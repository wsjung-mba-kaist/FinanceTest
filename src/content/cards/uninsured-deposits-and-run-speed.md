---
id: uninsured-deposits-and-run-speed
title: 무보험 예금과 런 속도
titleEn: Uninsured Deposits and Run Speed
tags: [liquidity, run, bank, deposits]
level: core
relatedMetrics: [uninsuredShare, dailyOutflowPct, cumulativeOutflowPct, survivalDays, runState]
sources: [fsb-depositor-behaviour-2024, fed-svb-review-2023, dfpi-svb-order-2023, fdic-oig-signature-2023, fdic-frc-supervision-2023, basel-lcr40, korea-kr-deposit-limit-2025, fsc-80363]
---

## 정의

무보험 예금(uninsured deposits)은 예금보험 한도를 초과해 은행 실패 시 손실 위험에 노출되는 예금이다(한국은 2025.9.1부터 1억원 초과분 [출처: korea-kr-deposit-limit-2025]). 런 속도(run speed)는 하루 또는 수시간 단위로 빠져나가는 예금의 비율이며, 2023년 이후 유동성 위기 관리의 핵심 변수가 됐다.

## 공식

```
무보험 비중 = 무보험 예금 / 총예금
일일 유출률 = 당일 순유출 / 기초 예금
생존 일수   = (현금 + 당일 담보차입 여력) / 예상 일일 순유출
```

## 위기에서 왜 중요한가

Basel LCR의 30일 유출률(안정 소매 3%, 운영성 25%, 비금융기업 40%, 금융기관 100%)은 예금자가 한 달에 걸쳐 서서히 이탈한다는 가정이다 [출처: basel-lcr40]. 무보험이면서 동질적이고(같은 산업), 네트워크로 연결되어 있으며(VC·SNS), 디지털 채널로 즉시 송금할 수 있는 예금 기반은 이 가정을 무너뜨린다. FSB는 2023년 3월의 런을 "fast-fail" 시나리오로 규정했다: 가장 빠른 3개 런은 일 20~30%, 중위 런도 7%/일로 과거(1%/일)의 7배였고, SVB는 실행분과 3/10 계획분을 합치면 80%를 넘었다. 과거 사례인 WaMu(16일 10.1%), 컨티넨탈 일리노이(10일 30%)와 비교하면 시간 축이 한 자릿수 일로 압축된 것이다 [출처: fsb-depositor-behaviour-2024].

## 역사적 사례

| 기관 | 무보험 비중 | 유출 | 시점 |
|---|---|---|---|
| SVB | 94%(지주 Y-9C) / 88%(FDIC) | $42B(~25%) | 2023.3.9 하루 |
| SVB | | 추가 $100B 대기 | 3.10 아침 |
| 시그니처 | | $18.6B(20%) | 3.10 수시간 |
| 퍼스트리퍼블릭 | | ~$25B(17%) | 3.10 |
| 퍼스트리퍼블릭 | | 1분기 예금 $176.4B → $104.5B | 4.24 공개 |

SVB의 무보험 비중은 출처별로 다르며(94% vs 88%), 둘 다 표시하는 것이 도시에 원칙이다 [출처: fed-svb-review-2023] [출처: dfpi-svb-order-2023]. 시그니처의 수시간 20% 유출은 FDIC OIG 사후평가에 기록돼 있다 [출처: fdic-oig-signature-2023]. 퍼스트리퍼블릭은 3/16 11개 은행의 $30B 예치로 약 5주를 벌었지만, 4/24 실적 공시가 런을 재점화했고 4/28 등급 강등이 재할인창구를 사실상 막아 5/1 폐쇄됐다 [출처: fdic-frc-supervision-2023].

한국에서는 2023.7 새마을금고 인출 사태에서 7월 중도해지가 41.7만 건(전년 20.3만)에 달했고, 7/7 재예치 조치와 7/10 "P&A 시 5천만원 초과도 전액 보장" 발표 [출처: fsc-80363] 이후 7/17 일 이탈이 6,000~7,000억으로 줄었다.

## 실무 체크포인트

- 예금을 보험/무보험뿐 아니라 동질성·네트워크·채널(디지털 송금 가능 여부)로 세그먼트화한다.
- 세그먼트별 일일 유출률을 런 상태(S0~S3)별로 두고, 최악 세그먼트가 하루 25~35% 빠지는 시나리오로 생존 일수를 계산한다.
- 소셜미디어·업계 네트워크(VC 이메일, 단체 채팅) 모니터링을 유동성 조기경보에 포함한다.
- 보험 스윕(insured cash sweep) 등 무보험→보험 전환 프로그램의 실행 소요일을 미리 확인한다.
- 대형 예금자 상위 100곳과의 직접 소통 채널을 평시에 구축한다.

## 관련 개념

[무보험 예금](term:uninsured-deposits) · [유출률](term:run-off-rate) · [LCR](term:lcr) · [예금자보호한도](term:deposit-insurance-limit) · [런 상태](term:run-state) · [비상자금조달계획](term:cfp)
