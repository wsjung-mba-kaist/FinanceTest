---
id: lcr-basics
title: 유동성커버리지비율(LCR) 기초
titleEn: Liquidity Coverage Ratio
tags: [basel3, liquidity, bank]
level: intro
relatedMetrics: [lcr, hqla, survivalDays]
sources: [bcbs-238, basel-lcr30, basel-lcr40, fsb-depositor-behaviour-2024, fed-svb-review-2023, finma-cs-report-2023, fsc-82312, fsc-83490]
---

## 정의

유동성커버리지비율(Liquidity Coverage Ratio, LCR)은 은행이 30일간의 심각한 유동성 스트레스를 자체 보유 자산으로 버틸 수 있는지를 재는 Basel III 지표다. 분자는 [고유동성자산(HQLA)](term:hqla), 분모는 규제가 정한 [유출률](term:run-off-rate)로 계산한 30일 순현금유출이며, 최소 기준은 100%다 [출처: bcbs-238].

## 공식

```
LCR = HQLA(헤어컷 적용 후) / 30일 순현금유출 ≥ 100%
30일 순현금유출 = Σ(부채 × 유출률) − min(Σ(자산 × 유입률), 유출 총액의 75%)
```

## 위기에서 왜 중요한가

LCR은 규제 하한이지 생존 보증이 아니다. 30일 유출률은 안정 소매예금 3%, 운영성 예금 25%, 비금융기업 40%, 금융기관 예금 100%로 설계되어 있는데 [출처: basel-lcr40], 2023년 3월의 런은 이 30일 허용치를 하루 이틀 만에 소진했다. FSB 분석에 따르면 가장 빠른 3개 런의 일일 유출은 20~30%였고, 과거 1%/일 수준이던 중위값도 7%/일로 올라갔다 [출처: fsb-depositor-behaviour-2024]. 따라서 위기 대응 실무는 규제 LCR과 함께 "당일 런 렌즈"(현금 + 당일 담보차입 여력 ÷ 익일 예상 유출 = 생존 일수)를 병행해 봐야 한다. 이 플랫폼의 대시보드가 두 렌즈를 나란히 표시하는 이유다.

또 하나의 함정은 적용 범위다. SVB는 2019년 tailoring 규칙으로 완전한 LCR 적용 대상이 아니었고, 내부 유동성 스트레스테스트(ILST)에서 4Q22 30일 부족이 반복되자 FHLB 차입을 늘리면서 가정을 완화했다 [출처: fed-svb-review-2023].

## 역사적 사례

- **SVB(2023.3.9)**: 하루 $42B(예금의 약 25%) 유출, 다음날 아침 추가 $100B 인출 대기 [출처: fed-svb-review-2023]. Basel 표의 어떤 유출률로도 설명되지 않는 속도다.
- **크레디트스위스(2023.3.15~17)**: 일별 유출 CHF 13.2B → 17.1B → 10.1B. 3/17 ELA+ 20B가 없었다면 정오에 즉시 지급불능이었다 [출처: finma-cs-report-2023].
- **한국**: 코로나 대응으로 85%까지 낮췄던 은행 원화 LCR을 2022.7 90% → 2022.10 92.5% → 2024 97.5%로 올려 2025.1.1 100%로 복귀시켰다 [출처: fsc-82312] [출처: fsc-83490]. 외화 LCR은 80%다.

## 실무 체크포인트

- LCR 100% 충족 여부와 별도로 "무보험·동질 예금이 하루 25% 빠지면 며칠 버티는가"를 매일 계산한다.
- HQLA 중 실제로 당일 현금화·담보화 가능한 금액(사전 예치 담보)을 구분해 둔다.
- ILST 위반을 가정 완화로 해소하지 않는다 — SVB 사후평가가 지목한 실패 지점이다.
- 규제 LCR 적용 대상이 아니더라도(tailoring, 소규모 기관) 내부 지표로 계산·보고한다.
- 유출률 가정을 세그먼트별(스타트업·운영성·소매·HNW)로 나누고 런 상태별로 재보정한다.

## 관련 개념

[HQLA](term:hqla) · [유출률](term:run-off-rate) · [NSFR](term:nsfr) · [무보험 예금](term:uninsured-deposits) · [비상자금조달계획](term:cfp) · [재할인창구](term:discount-window) · [ILST](term:ilst)
