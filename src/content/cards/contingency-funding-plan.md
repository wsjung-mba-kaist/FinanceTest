---
id: contingency-funding-plan
title: 비상자금조달계획(CFP)
titleEn: Contingency Funding Plan
tags: [liquidity, governance, bank, securities, basel3]
level: core
relatedMetrics: [survivalDays, facilityHeadroom, facilityPending, liquidityAvailable, projectedDailyOutflow]
sources: [bcbs-144, fed-sr-10-6, interagency-cfp-addendum-2023, fdic-oig-signature-2023, fed-svb-review-2023, dfpi-svb-order-2023]
---

## 정의

비상자금조달계획(Contingency Funding Plan, CFP)은 유동성 스트레스 시 누가·무엇을·어떤 순서로·얼마나 빨리 실행할지를 미리 정한 문서이자 운영 체계다. 바젤위원회 「유동성 리스크 관리 원칙」 원칙 11(¶110~117)이 국제 기준이고 [출처: bcbs-144], 미국은 SR 10-6 인터에이전시 정책성명(2023.8 개정)과 2023.7.28 부록이 이를 구체화한다 [출처: fed-sr-10-6] [출처: interagency-cfp-addendum-2023].

## 공식

BCBS 144 원칙 11이 요구하는 구성요소:

```
1. 책임 라인·발동 기준·에스컬레이션 절차
2. 다양하고 즉시 가용한 조치 목록(조치별 금액·리드타임 추정)
3. 스트레스테스트(일중 포함)와의 연계
4. 기관 고유 시나리오 + 시장 전체 시나리오
5. 위기팀 구성·연락처·대체자
6. 감독당국·중앙은행 접촉 시점과 결정권자
7. 시장·직원·고객·채권자·커스터디 커뮤니케이션 계획
8. 중앙은행 창구·담보 요건 반영
```

## 위기에서 왜 중요한가

2023년의 실패는 CFP가 없어서가 아니라 "종이 위의 CFP"였기 때문이다. 시그니처는 CFP를 발동했지만 일일 현금흐름 보고와 담보 테스트가 없었고, FDIC OIG는 유동성·비상자금조달 메커니즘이 불충분했다고 결론지었다 [출처: fdic-oig-signature-2023]. SVB는 4Q22 내부 유동성 스트레스테스트에서 30일 부족이 반복되자 FHLB 차입을 늘리는 한편 가정을 완화했다 [출처: fed-svb-review-2023]. 3/9 실제 런이 오자 담보를 FHLB에서 연준으로 옮기지 못해 마감 시 연준 계좌가 −$958M이 됐다 [출처: dfpi-svb-order-2023]. 2023.7.28 부록은 이 교훈을 반영해 재할인창구 운영 준비(담보 사전 예치)와 주기적 테스트 거래를 CFP의 일부로 명시했다 [출처: interagency-cfp-addendum-2023].

## 역사적 사례

2023년 사후평가와 BCBS 144·SR 10-6을 종합한 런 대응 실무 순서는 다음과 같다.

1. **T0**: CFP 발동, 위기팀 가동, 일중 현금흐름 보고 개시
2. **담보 차입 우선**: FHLB(사전 예치 담보); 연준 대출 전 FHLB 리엔 후순위화 필요
3. **재할인창구**: 사전 예치·테스트 거래 완료 상태; CAMELS 강등 시 2차 신용
4. **BTFP형 시설**(액면 담보) — 존재할 경우에만
5. **증권 매각**: AFS는 AOCI 실현, HTM은 테인팅
6. **증자·사모 예금·합병**: 미확정 발표는 런을 촉발, 확정 컨소시엄 예금은 약 5주 확보(퍼스트리퍼블릭)
7. **커뮤니케이션**: 감독당국에 조기, 예금자에 일관되게
8. **정리**: 최소비용 원칙, P&A, 브릿지뱅크, DINB, 시스템리스크 예외

시그니처의 주말이 보여주듯 담보 적격성·실사가 끝나 있지 않으면 상위 단계는 시간 안에 실행되지 않는다(월요일 송금 $7.9B vs 최선 유동성 $3.0B) [출처: fdic-oig-signature-2023].

## 실무 체크포인트

- 조치 목록마다 "금액·리드타임·전제조건(담보 예치 여부, 이사회 승인)"을 숫자로 적는다.
- 분기마다 재할인창구·FHLB 테스트 차입을 실제로 실행하고 결제까지 확인한다.
- 발동 트리거를 지표(ILST 위반, 일 유출 >3%, 주가 −20%/일, 강등)로 정의하고 자동 보고되게 한다.
- 일중 현금흐름 보고 체계를 평시에 가동해 둔다 — 런 당일에 만들 수 없다.
- 스트레스테스트 위반을 가정 완화로 해소한 이력이 있는지 감사한다.

## 관련 개념

[CFP](term:cfp) · [ILST](term:ilst) · [재할인창구](term:discount-window) · [FHLB](term:fhlb) · [BTFP](term:btfp) · [HTM 테인팅](term:htm-tainting) · [LCR](term:lcr) · [런 상태](term:run-state)
