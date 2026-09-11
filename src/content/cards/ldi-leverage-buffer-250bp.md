---
id: ldi-leverage-buffer-250bp
title: LDI 레버리지와 담보버퍼 — 250bp 기준
titleEn: LDI Leverage and the 250bp Collateral Buffer
tags: [ldi, pension, leverage, collateral, liquidity, uk]
level: core
relatedMetrics: [hedgeRatio, ldiLeverage, collateralHeadroomBp, marginCallPending, fundingRatio, govt30y]
sources: [boe-ldi-staff-paper-2023, tpr-ldi-guidance-2023, boe-qb-2023-gilt, boe-breeden-2022, imf-wp-2023-210]
---

## 정의

[부채연계투자(LDI)](term:ldi)는 확정급여(DB) 연기금이 부채의 금리·물가 민감도를 길트·스왑·[레포](term:repo) 레버리지로 맞추는 전략이다. 스킴은 자산의 일부만 LDI 펀드에 넣고 펀드가 레버리지로 부채 전체에 가까운 금리 익스포저를 만든다. 금리가 오르면 부채 가치가 줄어 펀딩비율은 개선되지만, 펀드의 헤지 포지션은 평가손을 내고 그 손실만큼 [변동증거금](term:variation-margin)이 즉시 현금·적격 길트로 나간다. 펀드가 미리 들고 있는 담보 여력을 [담보버퍼](term:collateral-buffer)라 하며 bp 단위 — "추가로 견딜 수 있는 금리 상승폭" — 로 표시한다.

## 공식

```
PV01        = 익스포저 × 수정듀레이션 / 10,000          (금리 1bp 상승당 손실)
레버리지     = 익스포저 / NAV
버퍼(bp)     = 유동 담보(현금 + 적격 길트) / PV01
손실(Δy bp)  = PV01 × Δy;  NAV 손실률 = 레버리지 × 듀레이션 × Δy
부족액       = max(0, 손실 − 유동 담보)  → 재자본화 요청, 미도착 시 익스포저 축소
```

예: 익스포저 4,200 · 듀레이션 18년 · NAV 1,400(3x) · 담보 907 → PV01 7.56, 버퍼 120bp. +130bp이면 손실 983 > 담보 907, NAV 손실률 3 × 18 × 1.3% ≈ 70%.

## 위기에서 왜 중요한가

2022년 9월 23~27일 30년 길트는 3거래일에 130bp 올랐다. 2000년 이후 최대 일일 변동은 29bp였는데 35bp를 넘는 날이 두 번 있었다 [출처: boe-ldi-staff-paper-2023]. 위기 전 다수 풀드 LDI 펀드의 버퍼는 100~150bp였고 3일 만에 소진되었다. 재자본화 자금이 도착하는 데 며칠이 걸리는 동안 펀드는 규정에 따라 익스포저를 잘라냈고, 담보를 만들기 위한 길트 매도가 금리를 더 올려 콜을 다시 키웠다 — [파이어세일](term:fire-sale) 스파이럴이다 [출처: boe-qb-2023-gilt]. 13일간 LDI 펀드는 £40bn 이상을 조달하고 £30bn 이상의 길트를 팔았다 [출처: boe-breeden-2022]. IMF는 마진콜 규모를 약 £70bn, 길트 매도를 약 £37bn으로 추정한다 [출처: imf-wp-2023-210].

레버리지가 높을수록 같은 충격에 NAV가 빨리 소진되고 레버리지 밴드(예: 4.5x)를 빨리 넘는다. 3x 펀드가 130bp에 NAV의 70%를 잃을 때 4x 펀드는 94%를 잃는다. 버퍼는 "역대 최대 변동"이 아니라 "다음 변동"을 견뎌야 한다.

## 역사적 사례

- **영국 LDI(2022.9~10)**: 9/28 영란은행이 장기 길트 임시 매입을 발표하자 30년물은 하루에 100bp 넘게 떨어졌다. [헤지비율](term:hedge-ratio)을 줄인 스킴은 부채 증가를 자산이 따라오지 못했다. 매입은 10/14 예정대로 끝났고(총 £19.3bn), 이후 업계는 버퍼를 300~400bp로 올렸다 [출처: boe-qb-2023-gilt].
- **사후 기준**: 2023년 3월 29일 FPC는 LDI 펀드의 최소 회복력을 250bp로 정했고 [출처: boe-ldi-staff-paper-2023], TPR은 4월 가이드에서 250bp 시장 스트레스 버퍼에 운영 버퍼를 더하고 담보 보충에 5영업일이 걸린다고 가정하도록 했다 [출처: tpr-ldi-guidance-2023].

## 실무 체크포인트

- 버퍼를 bp로 매일 계산하고, 최근 1주·1개월 누적 변동과 비교한다. 금리가 이미 많이 올랐다면 버퍼는 이미 줄어 있다.
- 레버리지 밴드 상한까지의 여유(NAV 기준)와 버퍼(bp)를 함께 본다 — 둘 중 먼저 닿는 쪽이 강제 축소를 만든다.
- 재자본화 소요 일수(승인 + 딜링 + 결제)를 재고, 그 기간의 예상 변동을 운영 버퍼로 더한다.
- 헤지 축소는 담보 문제를 금리 방향 베팅으로 바꾼다. 해법은 헤지를 유지할 담보다.
- 중앙은행 임시 매입은 시한부다. 창이 열린 동안 질서 있는 가격으로 버퍼를 재건한다.

## 관련 개념

[LDI](term:ldi) · [헤지비율](term:hedge-ratio) · [담보버퍼](term:collateral-buffer) · [마진콜](term:margin-call) · [변동증거금](term:variation-margin) · [레포](term:repo) · [듀레이션](term:duration) · [파이어세일](term:fire-sale)
