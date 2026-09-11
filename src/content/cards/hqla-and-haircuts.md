---
id: hqla-and-haircuts
title: 고유동성자산(HQLA)과 헤어컷
titleEn: HQLA and Haircuts
tags: [basel3, liquidity, collateral, bank, securities]
level: core
relatedMetrics: [hqla, lcr, facilityHeadroom, facilityPending, liquidAssets]
sources: [basel-lcr30, bcbs-238, cgfs-36, fsc-86917, fed-svb-review-2023, fdic-oig-signature-2023, dfpi-svb-order-2023, boe-qb-2023-gilt, boe-breeden-2022]
---

## 정의

고유동성자산(High-Quality Liquid Assets, HQLA)은 스트레스 상황에서도 가치 손실 없이 즉시 현금화할 수 있는 자산으로, LCR의 분자다. Basel은 자산을 Level 1(현금·지준·국채 등), Level 2A, Level 2B로 나누고 등급별 헤어컷과 상한을 둔다 [출처: basel-lcr30]. 헤어컷(haircut)은 담보·자산의 시장가치에서 차감하는 비율이며, 담보차입 여력을 결정한다.

## 공식

```
HQLA = Σ L1 × (1 − 0%) + Σ 2A × (1 − 15%) + Σ 2B_RMBS × (1 − 25%) + Σ 2B_기타 × (1 − 50%)
제약: L2 합계 ≤ HQLA의 40%, 2B 합계 ≤ 15%
담보차입 여력 = Σ 사전 예치 담보 시가 × (1 − 헤어컷)
```

## 위기에서 왜 중요한가

규제 HQLA와 "당일 쓸 수 있는 유동성"은 다르다. 중앙은행이나 FHLB에서 차입하려면 담보가 미리 예치·평가되어 있어야 하고, 헤어컷은 시장 관행에서 국채 트라이파티 레포 약 2%, IG 회사채 5~10%, 주식 15~25% 수준이다 [출처: cgfs-36]. 스트레스 시 헤어컷과 마진이 동시에 오르면 같은 담보로 빌릴 수 있는 금액이 줄어 유동성 여력이 자기강화적으로 축소된다. 게임 보정값(저작 가이드)은 FHLB 헤어컷을 국채 ~3%, MBS 7~10%, 주택담보 15~25%, 상업용부동산 30~40%로, 연준 재할인창구를 시가−마진(국채 1~3%, MBS 3~6%, 대출 10~50%)으로 둔다.

한국 증권사는 2027.1.1부터 유동성비율의 유동자산에 헤어컷을 적용한다: 국채·특수채·은행채·AAA 0%, AA 7%, A 이하 10%, 주식·외화·ETF 15%, 합성 ETF 30% [출처: fsc-86917].

## 역사적 사례

- **SVB(2023.3.9)**: 예금 $42B가 빠지는 날 담보를 FHLB에서 연준으로 옮기지 못해 cash letter를 결제하지 못했고, 마감 시 연준 계좌가 −$958M이었다 [출처: dfpi-svb-order-2023]. HTM 약 $91B를 보유하고도 재할인창구에 잡힌 담보는 "$5B 남짓"[2차]에 불과했다 [출처: fed-svb-review-2023].
- **시그니처(2023.3.10)**: 수시간 내 $18.6B(20%)가 빠졌고, FHLB가 담보를 후순위화해 준 뒤에야 뉴욕연준 창구로 $3.4B를 결제했다. 주말에는 담보 적격성·실사 미충족으로 월요일 송금 $7.9B 대비 최선 유동성 $3.0B에 그쳐 폐쇄됐다 [출처: fdic-oig-signature-2023].
- **영국 LDI(2022.9~10)**: 길트 급락으로 담보 콜이 쏟아지자 LDI 펀드는 13일간 £40bn 넘는 담보를 조달하려고 £30bn 이상의 길트를 팔았고, 이 매도가 다시 가격을 눌렀다 [출처: boe-breeden-2022]. 영란은행은 9/28 임시 매입에 이어 10/10 담보 범위를 넓힌 레포(TECRF, 회당 £10bn)를 열었다 [출처: boe-qb-2023-gilt].

## 실무 체크포인트

- HQLA 목록을 "규제 인정액"과 "당일 담보화 가능액(사전 예치·리엔 없음)"으로 이중 관리한다.
- FHLB 리엔이 걸린 담보는 연준 창구에 바로 쓸 수 없다 — 이전 절차와 소요 시간(≥1영업일)을 CFP에 적는다.
- 헤어컷 상승 시나리오(+5~10%p)로 담보차입 여력을 재계산하고 마진콜과의 동시 발생을 가정한다.
- HTM 증권도 담보로는 쓸 수 있다 — 매각(테인팅) 대신 담보화가 우선이다.
- 한국 증권사는 2027년 헤어컷 기준으로 유동성비율을 미리 산출해 본다.

## 관련 개념

[LCR](term:lcr) · [헤어컷](term:haircut) · [재할인창구](term:discount-window) · [FHLB](term:fhlb) · [담보버퍼](term:collateral-buffer) · [증권사 유동성비율](term:liquidity-ratio-kr) · [파이어세일](term:fire-sale) · [HTM 테인팅](term:htm-tainting)
