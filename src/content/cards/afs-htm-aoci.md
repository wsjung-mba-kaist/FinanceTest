---
id: afs-htm-aoci
title: AFS·HTM 회계와 AOCI
titleEn: AFS, HTM and AOCI
tags: [accounting, capital, bank, irrbb]
level: core
relatedMetrics: [unrealizedLoss, unrealizedLossPctCet1, cet1Ratio, economicTce]
sources: [fed-svb-review-2023, svb-8k-2023, fasb-asc-320, bcbs-d555, dfpi-svb-order-2023]
---

## 정의

은행이 보유한 채권은 회계상 매도가능증권(Available-for-Sale, AFS)과 만기보유증권(Held-to-Maturity, HTM)으로 분류된다. AFS는 공정가치로 평가하되 미실현손익을 손익계산서가 아닌 기타포괄손익누계액(Accumulated Other Comprehensive Income, AOCI)에 쌓고, HTM은 상각원가로 계상해 금리 변동에 따른 미실현손익이 재무제표 본문에 나타나지 않는다. 미국에서는 고급접근법을 쓰지 않는 은행이 AOCI를 규제자본에서 제외(옵트아웃)할 수 있어, AFS 손실조차 CET1에 반영되지 않는다 [출처: fed-svb-review-2023].

## 공식

```
AFS 장부가 = 공정가치;  ΔAFS 공정가치 → AOCI(자본), 손익 미반영
HTM 장부가 = 상각원가;  미실현손실은 주석 공시만
규제 CET1(AOCI 옵트아웃) = CET1 − 0 × AOCI
경제적 TCE 근사 = 회계상 유형보통주자본 − HTM 미실현손실의 세후 금액
AFS 평가손실은 회계자본에 이미 반영되므로 중복 차감하지 않음
```

## 위기에서 왜 중요한가

세 개의 자본이 서로 다른 그림을 보여준다. 규제 CET1은 양호하고, 회계 자본은 AFS 손실만큼 줄어 있으며, 경제적 자본은 HTM 손실까지 반영하면 사라져 있을 수 있다. 시장과 무보험 예금자는 세 번째 숫자를 본다. 2023년 연준 사후평가는 무보험 예금의 안정성 가정과 HTM 취급을 재평가해야 한다고 지적했고 [출처: fed-svb-review-2023], 바젤위원회 보고서도 금리·유동성·집중 리스크 관리의 기본적 실패를 원인으로 꼽았다 [출처: bcbs-d555]. 미국의 Basel III 엔드게임 재제안(2026.3.19)은 대형은행의 AFS 미실현손익을 자본에 반영하는 방향이다.

## 역사적 사례

SVB('22.12.31 기준)는 증권이 자산의 55%, 그중 HTM이 78%(약 $91B, 듀레이션 6.2년)였다. HTM 미실현손실은 약 $15B[2차], AFS는 약 $26B에 손실 약 $2.5B였다. 그럼에도 규제 CET1은 12%였고, AOCI 옵트아웃 효과가 $1.9B였다 [출처: fed-svb-review-2023]. 2022.7에는 순이자이익 헤지를 전량 해제해 금리 상승 노출을 키운 상태였다.

3/8 장 마감 후 8-K로 AFS 약 $21B 매각(세후 손실 약 $1.8B)과 $2.25B 증자를 공시하자 [출처: svb-8k-2023], 시장은 "AFS를 팔았으니 HTM 손실도 현실"이라고 읽었다. 다음날 주가는 −60%, 예금 유출은 $42B였다 [출처: dfpi-svb-order-2023]. 규제자본이 충분했다는 사실은 런을 막지 못했다.

## 실무 체크포인트

- 이사회 보고에 규제 CET1·회계 자본·경제적 TCE(미실현손실 세후 차감)를 나란히 둔다.
- HTM 비중과 듀레이션을 무보험 예금 비중과 함께 본다 — 긴 듀레이션 + 짧은 부채가 결합되면 금리 리스크가 곧 유동성 리스크다.
- AOCI 옵트아웃이 적용되더라도 내부 한도는 미실현손실/CET1 비율로 설정한다(엔진 기본값 경고 50%, 위반 100%).
- AFS 매각 결정은 그 자체가 HTM 손실을 시장에 확인시켜 주는 신호임을 전제로 커뮤니케이션을 설계한다.
- 금리 헤지 해제는 회계상 이익이 나도 경제적 노출을 키운다 — 해제 근거를 문서화한다.

## 관련 개념

[AFS](term:afs) · [HTM](term:htm) · [AOCI](term:aoci) · [HTM 테인팅](term:htm-tainting) · [CET1](term:cet1) · [경제적 자본(TCE)](term:tce) · [듀레이션](term:duration) · [IRRBB](term:irrbb)
