---
id: fdic-resolution-weekend
title: FDIC 정리 주말 — 최소비용, P&A, 브릿지뱅크, 시스템리스크 예외
titleEn: The FDIC Resolution Weekend
tags: [resolution, regulation, bank, policy]
level: advanced
relatedMetrics: [regulatorLevel, economicTce, survivalDays, uninsuredShare]
sources: [fdic-pr-16-2023, dfpi-svb-order-2023, fed-btfp-term-sheet-2023, fdic-oig-signature-2023, fdic-frc-supervision-2023, fsc-71188, fsc-80363]
---

## 정의

미국 은행 정리는 인가 당국(주 또는 OCC)이 은행을 폐쇄하고 FDIC를 관재인(receiver)으로 지정하면서 시작된다. FDIC는 최소비용 원칙(least-cost test) 아래 예금보험기금(DIF) 부담이 가장 적은 방식을 골라야 하며, 도구는 예금·자산을 인수자에게 넘기는 P&A(Purchase and Assumption), 인수자를 찾을 때까지 영업을 잇는 브릿지뱅크(bridge bank), 부보예금만 지급하는 DINB(Deposit Insurance National Bank), 그리고 예외적으로 무보험 예금까지 보호하는 시스템리스크 예외(Systemic Risk Exception, SRE)다.

## 공식

```
최소비용 원칙: 선택 방식의 DIF 추정 손실 ≤ 청산·부보예금 지급 시 손실
P&A: 인수 제안·자산 실사·손실 분담·최소비용 비교를 거쳐 판단
R0~R4와 인수 조건: 각 시나리오의 훈련 규칙이며 공통 법정 기준이 아님
```

## 위기에서 왜 중요한가

금요일 폐쇄 후 월요일 예금 접근과 핵심 기능을 복구하려면 주말 안에 초기 정리 구조를 마련해야 한다. 전체 자산 처분과 인수 절차까지 주말 안에 끝나는 것은 아니다. 그 안에 자산 실사, 입찰, 인수자 확보, 예금자 접근 복구가 이루어지지 않으면 무보험 예금자가 월요일에 자금을 쓰지 못하고, 그 공포가 유사 은행으로 번진다. 2023년에는 SVB 단독 정리로 전이를 막을 수 없다는 판단이 SRE와 BTFP라는 시스템 조치로 이어졌다.

## 역사적 사례

**2023.3.10(금) → 3.13(월)**

| 시각 | 조치 |
|---|---|
| 3/10 아침 | DFPI가 SVB 폐쇄(유동성 부족·지급불능), FDIC 관재인 지정 [출처: dfpi-svb-order-2023] |
| 3/10 | FDIC, DINB of Santa Clara 설립 — 부보예금은 3/13 월요일 접근 [출처: fdic-pr-16-2023] |
| 3/12 17:30 | NYDFS가 시그니처 폐쇄(최선 유동성 $3.0B vs 월요일 송금 $7.9B) [출처: fdic-oig-signature-2023] |
| 3/12 저녁 | SRE 발동: SVB·시그니처 전 예금 보호, 주주·일부 무담보채권자 미보호; BTFP 창설 [출처: fed-btfp-term-sheet-2023] |
| 3/13 | 두 은행 브릿지뱅크 설립 |
| 3/26 | 퍼스트시티즌스가 SVB 인수(자산 $72B, $16.5B 할인) |
| 5/1 | 퍼스트리퍼블릭 폐쇄, JPM 인수 [출처: fdic-frc-supervision-2023] |

정리 비용은 DIF 기준 SVB 약 $16.1B, 퍼스트리퍼블릭 약 $13B로 추산됐다.

**한국의 대응물**: 2011 저축은행 사태에서 예보는 가교 예솔저축은행(2011.10.19, 예보 100%)을 세워 부산저축은행 인가취소(11/23) 후 최소비용원칙으로 계약이전했고, 이후 신한·BS·KB·하나 등 지주에 매각했다. 삼화는 우리금융저축은행으로 P&A(3/16)됐다. 구조조정 특별계정 지원은 31개사 27.2조였다 [출처: fsc-71188]. 2023.7 새마을금고에서는 "부실 우려 금고는 우량금고로 P&A → 5천만원 초과도 전액 보장"이 발표됐다 [출처: fsc-80363]. 1998.6.29에는 5개 은행이 P&A로 퇴출됐다.

## 실무 체크포인트

- (감독당국) 목요일 밤~금요일 아침 폐쇄 시점을 결정할 때 "월요일 개장 시 무보험 예금자 접근"을 기준으로 역산한다.
- (은행) R3 단계에서 FDIC 현장 실사에 필요한 대출·증권 데이터룸을 24~48시간 내 열 수 있게 준비한다.
- 자본이 훼손돼도 손실 분담과 입찰 조건에 따라 P&A가 가능하다. 특정 TCE 비율만으로 P&A·브릿지뱅크·청산을 자동 결정하지 말고, 매각 가능성과 예금 접근 복구를 함께 검토한다.
- SRE는 개별 은행이 계획에 넣을 수 없는 시스템 차원의 예외다 — 자기 생존 계획에서 배제한다.
- 자발적 관리 동의(질서 있는 실패)는 무질서 폐쇄보다 예금자·DIF 손실이 적다 — 게임오버 규칙에도 부분점수가 있다.

## 관련 개념

[P&A](term:pna) · [브릿지뱅크](term:bridge-bank) · [DINB](term:dinb) · [관재](term:receivership) · [시스템리스크 예외](term:systemic-risk-exception) · [정리](term:resolution) · [베일인](term:bail-in) · [RRP](term:rrp) · [긴급유동성지원](term:ela)
