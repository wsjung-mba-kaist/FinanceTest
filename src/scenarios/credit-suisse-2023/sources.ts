import type { Source } from '../../engine/types'

/**
 * credit-suisse-2023 서지. 공유 서지(src/content/sources.ts)와 같은 id는 같은 문서를 가리키며,
 * 시나리오가 단독으로도 무결성 린트를 통과하도록 여기에 다시 적는다
 * (`finma-cs-report-2023`이 그 경우다 — 공유 목록에 이미 있으므로 내용을 바꾸지 않고 그대로 옮겼다).
 *
 * 언론 출처(press)는 사건 시각·발언·주가 종가 같은 2차 수치에만 쓰고, 지원 규모·상각액·보증액 등
 * 정책 수치의 근거로는 쓰지 않는다. 정책 수치는 전부 FINMA·SNB·연방정부 문서와 연방 관보(AS)에서 온다.
 */
export const CS_SOURCES: Source[] = [
  {
    id: 'ubs-cs-completion-2023-06-12',
    title: 'UBS completes acquisition of Credit Suisse',
    publisher: 'UBS',
    date: '2023-06-12',
    url: 'https://www.ubs.com/global/en/investor-relations/press-releases/overview-news-display-ndp/en-20230612-ubs-credit-suisse-acquisition.html',
    kind: 'primary',
    note: '3월 19일 인수 합의 발표와 6월 12일 인수 완료를 구분한다. 인수 완료는 크레디트스위스 은행 법인 소멸과도 다른 사건이다.',
  },
  // ───────── 1차 법령 (연방 관보) ─────────
  {
    id: 'plb-eo-2023-135',
    title:
      'Verordnung über zusätzliche Liquiditätshilfe-Darlehen und die Gewährung von Ausfallgarantien des Bundes für Liquiditätshilfe-Darlehen der Schweizerischen Nationalbank an systemrelevante Banken (SR 952.3)',
    publisher: 'Schweizerischer Bundesrat (스위스 연방평의회)',
    date: '2023-03-16',
    url: 'https://www.fedlex.admin.ch/eli/oc/2023/135/de',
    kind: 'primary',
    note: '연방헌법 제184조 제3항·제185조 제3항에 근거한 긴급명령(2023-03-16 발효, AS 2023 135). 추가 유동성지원대출(ELA+)과 SNB 유동성지원대출에 대한 연방정부 이행보증(PLB)을 창설하고, 두 수단에 파산 시 우선변제권(Konkursprivileg)을 부여한다. ELA+·PLB는 차입자가 자체 자금조달 수단을 모두 소진한 뒤에만 지급될 수 있으며 FINMA가 그 사실을 연방재무부에 확인해야 한다',
  },
  {
    id: 'plb-eo-2023-136',
    title:
      'Änderung vom 19. März 2023 der Verordnung über zusätzliche Liquiditätshilfe-Darlehen … (AS 2023 136)',
    publisher: 'Schweizerischer Bundesrat (스위스 연방평의회)',
    date: '2023-03-19',
    url: 'https://www.fedlex.admin.ch/eli/oc/2023/136/de',
    kind: 'primary',
    note: '원문 확인. **제5a조(Zusätzliches Kernkapital)**: "Im Zeitpunkt der Kreditbewilligung nach Artikel 5 kann die FINMA gegenüber der Darlehensnehmerin und der Finanzgruppe anordnen, zusätzliches Kernkapital abzuschreiben." **제10a조(Abweichungen vom Fusionsgesetz)**: 시스템적 중요 은행 간 합병거래에는 "keiner Beschlüsse der Generalversammlungen der beteiligten Gesellschaften"가 필요하지 않으며 합병법 제11·14·15·16조가 적용되지 않는다(FINMA와 조율한 경우). **제14a조**: 손실보전 보증 최대 90억 프랑, 인수은행이 정리대상 자산에서 확정손실 50억 프랑을 부담한 뒤에야 지급. 발효 시각은 2023년 3월 19일 20시',
  },

  // ───────── 감독·중앙은행 문서 ─────────
  {
    id: 'finma-cs-report-2023',
    title: 'Lessons Learned from the CS Crisis',
    publisher: 'Swiss Financial Market Supervisory Authority (FINMA)',
    date: '2023-12-19',
    url: 'https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/finma-publikationen/cs-bericht/20231219-finma-bericht-cs.pdf',
    kind: 'regulatory',
    note: '원문 확인(공유 서지 src/content/sources.ts와 동일 id). 이 시나리오 수치의 주 출처다 — 일별 예금유출(3/13 1.6 → 3/14 2.7 → 3/15 13.2 → 3/16 17.1 → 3/17 10.1십억 프랑), 3/15 "CDS spreads rose above the 1000 basis-point mark (=10%)"와 "certain AT1 instruments were trading at just 23% of their nominal value", 3/16 ELA 38 + LSFF 10 = 48십억, 3/17 ELA+ 20십억("Without this further support, CS would have become immediately insolvent by midday on Friday, 17 March 2023"), 3/20 ELA+ 30 + PLB 70, 3월 말 누계 168십억, AT1 165억 프랑(명목) 상각, §5.5의 네 갈래 선택지(UBS 합병 / FINMA 명령에 의한 정리 / 국유화 / 파산+긴급계획)와 정리 시 필요한 자본조치 약 730억 프랑, 4Q22 예금유출 1,380억 프랑·10월 920억 프랑(LCR 모형 910억), 2021년말 LCR 203%',
  },
  {
    id: 'finma-snb-statement-2023-03-15',
    title: 'FINMA and the SNB issue statement on market uncertainty',
    publisher: 'FINMA · Schweizerische Nationalbank (SNB)',
    date: '2023-03-15',
    url: 'https://www.finma.ch/en/news/2023/03/20230315-mm-statement/',
    kind: 'regulatory',
    note: '3월 15일 저녁 공동성명. FINMA는 당시 확보한 주요 수치를 근거로 CS가 시스템적 중요 은행에 부과된 특별 자본·유동성 요건을 충족한다고 확인했고, SNB는 필요 시 유동성을 공급하겠다고 밝혔다. 미국 은행권 혼란이 스위스 기관에 직접적 전염 위험을 주지 않는다는 판단도 함께 제시되었다',
  },
  {
    id: 'finma-pr-2023-03-19',
    title: 'FINMA approves merger of UBS and Credit Suisse',
    publisher: 'FINMA',
    date: '2023-03-19',
    url: 'https://www.finma.ch/en/news/2023/03/20230319-mm-cs-ubs/',
    kind: 'regulatory',
    note: '원문(PDF) 확인. 인용: "The extraordinary government support will trigger a complete write-down of the nominal value of all AT1 debt of Credit Suisse in the amount of around CHF 16 billion, and thus an increase in core capital." 또한 "There was a risk of the bank becoming illiquid, even if it remained solvent"로 지급능력과 유동성을 명시적으로 구분한다. 연방정부의 손실보전 보증과 SNB의 연방보증부 대출을 함께 언급',
  },
  {
    id: 'finma-pr-2023-03-23-at1',
    title: 'FINMA provides information about the basis for writing down AT1 capital instruments',
    publisher: 'FINMA',
    date: '2023-03-23',
    url: 'https://www.finma.ch/en/news/2023/03/20230323-mm-at1-kapitalinstrumente/',
    kind: 'regulatory',
    note: '원문 확인. 인용: "The AT1 instruments issued by Credit Suisse contractually provide that they will be completely written down in a \'Viability Event\', in particular if extraordinary government support is granted." 3월 19일 연방정부 이행보증부 특별 유동성지원대출 공여가 계약상 존립사유(viability event)를 충족시켰다는 것이 FINMA의 논리이며, 긴급명령이 FINMA에 AT1 상각을 명령할 권한을 부여했다고 밝힌다. 영향을 받은 12개 상품을 개별로 열거하되 합계 명목액은 적지 않는다',
  },
  {
    id: 'snb-pr-2023-03-19',
    title:
      'Swiss National Bank provides substantial liquidity assistance to support UBS takeover of Credit Suisse',
    publisher: 'Schweizerische Nationalbank (SNB)',
    date: '2023-03-19',
    url: 'https://www.snb.ch/en/publications/communication/press-releases/2023/pre_20230319_1',
    kind: 'regulatory',
    note: '보도자료 PDF 원문 확인(2026-09). "Both banks have unrestricted access to the SNB\'s existing facilities" · "Credit Suisse and UBS can obtain a liquidity assistance loan with privileged creditor status in bankruptcy for a total amount of up to CHF 100 billion" · "the SNB can grant Credit Suisse a liquidity assistance loan of up to CHF 100 billion backed by a federal default guarantee. The structure of the loan is based on the Public Liquidity Backstop (PLB), the key parameters of which were already decided by the Federal Council in 2022." 즉 ELA+ 1,000억은 **두 은행 합산 한도**이고 PLB 1,000억은 CS 전용이다. PDF 경로: /public/asset/en/www-snb-ch/publications/communication/press-releases/2023/pre_20230319_1/publications0_en/pre_20230319.en.pdf',
  },
  {
    id: 'snb-mpa-2022-2023',
    title: 'Monetary policy assessments of 22 September 2022, 15 December 2022 and 23 March 2023',
    publisher: 'Schweizerische Nationalbank (SNB)',
    date: '2023-03-23',
    url: 'https://www.snb.ch/en/publications/communication/press-releases/2022/pre_20221215',
    kind: 'primary',
    note:
      '세 보도자료 PDF 원문 확인(2026-09). 2022-09-22 "SNB policy rate to 0.5%" — 0.75%p 인상, ' +
      '"applies from tomorrow, 23 September 2022". 2022-12-15 "SNB policy rate to 1.0%" — 0.5%p 인상, ' +
      '"applies from tomorrow, 16 December 2022". 2023-03-23 "SNB policy rate to 1.5%" — ' +
      '"applies from tomorrow, 24 March 2023". **따라서 2023-03-13의 정책금리 1.00%는 2022-09-22가 아니라 ' +
      '2022-12-15 결정(12-16 적용)에서 온 것이다.** PDF 경로는 ' +
      '/public/asset/en/www-snb-ch/publications/communication/press-releases/{연도}/pre_{YYYYMMDD}/publications0_en/pre_{YYYYMMDD}.en.pdf',
  },
  {
    id: 'snb-fsr-2023',
    title: 'Financial Stability Report 2023',
    publisher: 'Schweizerische Nationalbank (SNB)',
    date: '2023-06-22',
    url: 'https://www.snb.ch/en/publications/financial-stability-report',
    kind: 'regulatory',
    pages: 'pp. 23, 25',
    note: 'PDF 원문 확인(2026-09). 인쇄본 p.25 연표: "On 16 March, Credit Suisse confirms its intention to access emergency liquidity support from the SNB for up to CHF 50 billion. The SNB provides CHF 38 billion in liquidity under emergency liquidity assistance (ELA) and CHF 10 billion under the liquidity-shortage financing facility (LSFF)." · "On 17 March, the SNB provides additional emergency liquidity assistance (ELA+) of CHF 20 billion." · "On 20 March, the SNB provides CHF 30 billion in ELA+ and CHF 70 billion in liquidity assistance under the public liquidity backstop (PLB)." · 5월 31일 기준 잔액 880억(ELA 380 + ELA+ 500, PLB 전액 상환). 인쇄본 p.23: 긴급명령 ELA+는 **무담보 1,000억 한도**("emergency liquidity assistance of up to CHF 100 billion without collateral being delivered")이고 PLB 1,000억은 CS 전용이며 연방 이행보증이 붙는다. 같은 쪽: CS의 CDS 프리미엄(각주 1 "Premia for credit protection (five-year senior)")이 **3월 15일 1,000bp를 넘어 정점**을 찍었고, 4Q22 그룹 순유출 자산 1,110억 프랑 중 약 3분의 2가 10월에 발생했다. PDF 경로: /public/asset/en/www-snb-ch/publications/financial-stability-report/2023/stabrep_2023/publications0_en/stabrep_2023.en.pdf',
  },
  {
    id: 'federal-council-2023-03-19',
    title:
      'Safeguarding financial market stability: Federal Council welcomes and supports UBS takeover of Credit Suisse',
    publisher: 'Schweizerischer Bundesrat / Eidgenössisches Finanzdepartement (EFD)',
    date: '2023-03-19',
    url: 'https://www.admin.ch/gov/en/start/documentation/media-releases.msg-id-93793.html',
    kind: 'regulatory',
    note: '연방평의회가 인수를 지지하고 SNB의 추가 유동성지원에 연방 이행보증을 제공한다고 발표. 이 HTML 페이지 자체에는 금액이 없으나 **금액은 `findel-2023-03-19`(재정대표단 서한 원문)로 확정했다** — 종전 [VERIFY] 해소',
  },
  {
    id: 'findel-2023-03-19',
    title:
      'Nachtrag I 2023 (23.007) — Bewilligung dringlicher Kredite in der Höhe von insgesamt 109 Milliarden Franken (재정대표단이 양원 의장에게 보낸 서한, Ref. 600-23.02)',
    publisher: 'Finanzdelegation der eidgenössischen Räte (Bundesversammlung)',
    date: '2023-03-19',
    url: 'https://www.parlament.ch/centers/documents/de/Brief%20FinDel%20an%20Ratspr%C3%A4sidien%20vom%2019.03.2023%20-%20D.pdf',
    kind: 'primary',
    note:
      'PDF 원문 확인(2026-09). "Der Bundesrat unterbreitete der Finanzdelegation am 16. März 2023 einen ' +
      'Antrag auf Zustimmung zu einem dringlichen Verpflichtungskredit in der Höhe von 100 Milliarden ' +
      'Schweizer Franken. Am 19. März 2023 unterbreitete er einen weiteren Antrag in der Höhe von ' +
      '9 Milliarden Franken für die Gewährung einer Verlustgarantie." · "Am Sonntag, 19. März 2023, hat ' +
      'die Finanzdelegation beiden Kreditanträgen zugestimmt." 근거 법령은 재정법(FHG) 제28조제3항이고, ' +
      '긴급명령은 **2023-03-16 20:00 발효**했다("Die Verordnung trat am 16. März 2023 um 20.00 Uhr in ' +
      'Kraft"). 즉 1,000억 요청은 3/16, 90억 요청은 3/19, 승인은 둘 다 3/19 밤이다. 같은 서한은 ' +
      '2022년 스위스 명목 GDP를 "rund 771,22 Milliarden Schweizer Franken"으로, 시스템적 은행 파산의 ' +
      '누적 비용을 위기 전 GDP의 19~158%로 인용한다',
  },

  // ───────── 크레디트스위스·UBS 공시 ─────────
  {
    id: 'cs-4q22-earnings',
    title: 'Credit Suisse Group AG — 4Q22 Earnings Release (Form 6-K, exhibit 99.1)',
    publisher: 'Credit Suisse Group AG / U.S. Securities and Exchange Commission (EDGAR)',
    date: '2023-02-09',
    url: 'https://www.sec.gov/Archives/edgar/data/1053092/000137036823000011/a230209q4er-ex99_1.htm',
    kind: 'primary',
    note: '원문 확인. 2022년 말 총자산 5,313.58억 프랑(CHF 531,358백만), CET1 비율 14.1%, 3개월 평균 일별 LCR 144%, 4Q22 고객예금 1,380억 프랑 감소, 2022년 순손실 72.93억 프랑. 4Q22 순자금유출 1,105억 프랑(연간 1,232억 프랑)',
  },
  {
    id: 'cs-ar-2022',
    title:
      'Credit Suisse Group AG / Credit Suisse AG — Annual Report 2022 (= Form 20-F for FY2022, 공동 제출)',
    publisher: 'Credit Suisse Group AG / U.S. Securities and Exchange Commission (EDGAR)',
    date: '2023-03-14',
    kind: 'primary',
    url: 'https://www.sec.gov/Archives/edgar/data/1053092/000137036823000026/cs-20221231.htm',
    note:
      '접수번호 0001370368-23-000026. **Credit Suisse Group AG의 CIK은 1159510이고 1053092는 Credit ' +
      'Suisse AG(은행)이며, 이 20-F는 두 등록인의 공동 제출이라 EDGAR가 양쪽 CIK 아래 색인한다.** ' +
      '2026-09 원문 확인 — 이 시나리오의 2022-12-31 대차대조표 수치가 전부 여기서 온다: ' +
      '고객예금 **233,235**(Bank 234,554) · 총자산 **531,358**(Bank 530,039) · 총부채 **486,027** · ' +
      '자기자본 **45,129**(+비지배지분 202 = 총자본 45,331) · RWA **BIS 250,540 / 스위스 250,963**(Bank BIS 249,536) · ' +
      'CET1 비율 14.1% · 레버리지 익스포저 650,551 · 주석 25 Deposits "Total deposits 245,140 … of which ' +
      'customer deposits 233,235". 공시 지연·내부통제: 2023년 3월 14일 공시(당초 3월 9일 예정에서 미국 ' +
      '증권거래위원회의 2019·2020년 현금흐름표 관련 질의로 3/9 예정에서 3/14로 연기), 2022·2021년 말 재무보고 ' +
      '내부통제가 유효하지 않다고 결론(material weaknesses)했고 감사인 PwC는 내부통제에 부적정 의견을 냈다. ' +
      '**용어 주의**: CS는 4분기에 "Financial Report"를 내지 않는다 — 분기 Financial Report는 1~3분기뿐이고 ' +
      '4Q는 Earnings Release(`cs-4q22-earnings`)와 이 연차보고서다. 종전 note들이 가리키던 ' +
      '"4Q22 Financial Report"라는 문서는 존재하지 않는다',
  },
  {
    id: 'cs-pr-2023-03-16',
    title:
      'Credit Suisse announces its intention to access the SNB’s Covered Loan Facility and a short-term liquidity facility of up to CHF 50 billion, and cash tender offers',
    publisher: 'Credit Suisse Group AG / SEC EDGAR (Form 6-K)',
    date: '2023-03-16',
    url: 'https://www.sec.gov/Archives/edgar/data/1053092/000137036823000035/a230316-6k-tenderoffer.htm',
    kind: 'primary',
    note: '3월 16일 새벽 공표. SNB의 담보부대출창구(Covered Loan Facility)와 단기 유동성창구를 합쳐 최대 약 500억 프랑까지 이용할 뜻을 밝히고, 동시에 미달러 선순위채 10종(최대 25억 달러)과 유로 선순위채 4종(최대 5억 유로)에 대한 현금 공개매수를 발표했다. 실제로 SNB가 그날 공여한 금액은 480억 프랑이다(ELA 380 + LSFF 100)',
  },
  {
    id: 'ubs-cs-merger-2023-03-19',
    title: 'UBS to acquire Credit Suisse (합병 조건 공표)',
    publisher: 'UBS Group AG · Credit Suisse Group AG',
    date: '2023-03-19',
    kind: 'primary',
    url: 'https://www.sec.gov/Archives/edgar/data/1610520/000161052023000056/newsrelases6k20230320.htm',
    note: 'UBS Group AG / UBS AG Form 6-K(2023-03-20 제출)에 첨부된 2023-03-19자 보도자료 원문 확인(2026-09). "Under the terms of the all-share transaction, Credit Suisse shareholders will receive 1 UBS share for every 22.48 Credit Suisse shares held, equivalent to CHF 0.76/share for a total consideration of CHF 3 billion." 같은 문단: "UBS benefits from CHF 25 billion of downside protection from the transaction to support marks, purchase price adjustments and restructuring costs, and additional 50% downside protection on non-core assets." 켈러허 회장 발언 "as far as Credit Suisse is concerned, this is an emergency rescue"도 이 원문에 있다. 협상 개시 주체는 "the Swiss Federal Department of Finance, FINMA and the Swiss National Bank"로 명시된다',
  },

  // ───────── 국제 당국 대응 ─────────
  {
    id: 'srb-eba-ecb-2023-03-20',
    title:
      'SRB, EBA and ECB Banking Supervision statement on the announcement on 19 March 2023 by Swiss authorities',
    publisher: 'Single Resolution Board · European Banking Authority · ECB Banking Supervision',
    date: '2023-03-20',
    url: 'https://www.bankingsupervision.europa.eu/press/pr/date/2023/html/ssm.pr230320~9f0ae34dc5.en.html',
    kind: 'regulatory',
    note: '스위스 당국 발표 다음 날 아침의 공동성명. 핵심 문장: "common equity instruments are the first ones to absorb losses, and only after their full use would Additional Tier 1 be required to be written down." 유럽 정리체계에서는 보통주가 먼저 손실을 흡수하고 그 다음이 AT1이라는 서열을 재확인하며, 이 접근이 과거 사례에서도 일관되게 적용되었고 앞으로도 SRB와 ECB 감독의 위기 대응을 규율할 것이라고 밝힌다',
  },
  {
    id: 'central-banks-swap-2023-03-19',
    title: 'Coordinated central bank action to enhance the provision of US dollar liquidity',
    publisher:
      'Bank of Canada · Bank of England · Bank of Japan · European Central Bank · Federal Reserve · Swiss National Bank',
    date: '2023-03-19',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20230319a.htm',
    kind: 'regulatory',
    note: '6개 중앙은행이 상설 미달러 스와프 라인의 7일물 운영 빈도를 주 1회에서 매일로 확대한다고 공동 발표. 매일 운영은 2023년 3월 20일 월요일부터 최소 4월 말까지 지속하기로 했다. CS-UBS 합병 발표와 같은 일요일 저녁에 나왔다',
  },
  {
    id: 'bis-fsi-briefs-21',
    title: 'Upside down: when AT1 instruments absorb losses before equity (FSI Briefs No 21)',
    publisher: 'Bank for International Settlements — Financial Stability Institute',
    date: '2023-09-12',
    url: 'https://www.bis.org/fsi/fsibriefs21.pdf',
    kind: 'regulatory',
    note: 'Coelho·Taneja·Vrbaski. 일부 AT1이 보통주(CET1)가 완전히 소진되기 전에 전액 상각될 수 있고, 그 결과 AT1 채권자에게서 주주에게로 가치가 이전된다는 점을 정면으로 다룬다. 여러 관할에서 이런 단독 상각이 기술적으로 가능하지만, 그 실무적 결과 때문에 당국이 이를 정리 국면으로 한정하게 될 수 있으며 그 경우 AT1의 계속기업 손실흡수 기능 자체가 약해진다고 지적하고, AT1 상품 조건의 투명성 제고를 권고한다',
  },

  // ───────── 사후 검토·사법 절차 ─────────
  {
    id: 'puk-cs-2024',
    title:
      'Bericht der Parlamentarischen Untersuchungskommission «Geschäftsführung der Behörden – CS-Notfusion»',
    publisher: 'Parlamentarische Untersuchungskommission (PUK), Schweizerische Bundesversammlung',
    date: '2024-12-17',
    url: 'https://www.parlament.ch/centers/documents/de/Bericht%20auf%20Deutsch%20Publikationsversion.pdf',
    pages: '569 pp. (Zusammenfassung pp.2~36, Kap. 15 Schlussbemerkungen pp.492~)',
    kind: 'primary',
    note: '독일어 최종보고서 원문(569쪽) 확인(2026-09) — 종전 [VERIFY] 해소. "Die Kommission tagte zwischen Juni 2023 und Dezember 2024 an insgesamt 45 Sitzungen"; 문서는 "an die 30 000 Seiten"; **청문은 "79 Anhörungen"이고 대상은 62명이다** — 종전 노트의 "79명 청문"을 정정한다("Sie befragte im Rahmen von 79 Anhörungen insgesamt 62 Vertreterinnen und Vertreter"). 전문가 위탁 9건, 조사대상 기간은 2015년부터. 권고 20건 + 포스툴라트 6 · 모션 4 · 의원발의 1. 제15장: "die Verantwortung für die Schieflage der CS ... liegt beim Verwaltungsrat und der Geschäftsleitung der CS der letzten Jahre" — 2010~2022년 경영진 성과급 398억 프랑 대 같은 기간 총손실 337억 프랑. 당국에 대해서는 **"die Geschäftsführung der Behörden in den Jahren vor der Krise das Missmanagement und die daraus resultierenden Probleme der CS weder verursacht noch verstärkt hat"** 로 적는다(종전 노트의 "kausales Fehlverhalten"은 보고서 문언이 아니므로 이 인용으로 대체). 동시에 PLB 도입이 "zu zögerlich" 했고 그 점에서 당국의 업무수행은 "rechtmäßig, jedoch nur bedingt zweckmäßig ... nur bedingt wirksam"이라고 평가하며, 2017년 FINMA가 CS에 허용한 **규제필터(regulatorischer Filter)** 의 자본 효과가 당초 추정의 두 배에 달했다고 지적한다. 위기모드 전환 시점(2022년 10월 초)은 적절했다고 본다',
  },
  {
    id: 'bvger-at1-2025',
    title: 'Unlawful write-off of AT1 capital instruments (언론공지, 부분판결 B-2334/2023)',
    publisher: 'Bundesverwaltungsgericht (스위스 연방행정법원)',
    date: '2025-10-14',
    url: 'https://www.bvger.ch/en/newsroom/media-releases/unlawful-write-off-of-at1-capital-instruments-2385',
    kind: 'primary',
    note: '2025년 10월 1일자 부분판결(사건번호 B-2334/2023)을 2025년 10월 14일 공표. FINMA의 2023년 3월 19일 처분을 취소했다. 은행법 제26조와 금융시장감독법 제31조는 대상이 다르고 지나치게 포괄적이어서 제3자 권리의 상각 근거가 될 수 없으며, 긴급명령 제5a조도 긴급명령의 요건·수용권 위임·소유권 보장에 비추어 충분한 법적 근거가 되지 못한다고 보았다. 보상은 명하지 않았다. **도시에의 "2025.10.14 판결"은 공표일이며 판결일은 10월 1일이다**',
  },
  {
    id: 'finma-at1-appeal-2025',
    title: 'FINMA to appeal partial decision of the Federal Administrative Court concerning AT1',
    publisher: 'FINMA',
    date: '2025-10-15',
    url: 'https://www.finma.ch/en/news/2025/10/20251015-meldung-bvger-at1/',
    kind: 'regulatory',
    note: 'FINMA는 30일 항소기간 안에 연방대법원(Bundesgericht)에 상고하겠다고 밝혔다. 해당 부분판결은 약 360건의 절차 중 첫 건이다(FINMA 2023.12 보고서는 약 2,500명의 AT1 보유자가 230건을 제기했다고 적었다 — 이후 건수가 늘었다). [VERIFY] 2026년 9월 현재 연방대법원 판단 여부·결과는 확인하지 못했다 — 해소 문서: 연방대법원 판례 데이터베이스(bger.ch) 사건검색 또는 FINMA 후속 공지',
  },

  // ───────── 시계열 데이터 ─────────
  {
    id: 'fred-dbaa',
    title: 'FRED 계열 DBAA — Moody’s Seasoned Baa Corporate Bond Yield (일별)',
    publisher: 'Federal Reserve Bank of St. Louis (FRED)',
    date: '2023-03',
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DBAA',
    kind: 'data',
    note: '직접 조회 확인(2023-03-13 5.69 · 03-14 5.75 · 03-15 5.73 · 03-16 5.72 · 03-17 5.60 · 03-20 5.66). ICE BofA 투자등급 OAS(BAMLC0A0CM)는 익명 다운로드에서 최근 3년만 반환되므로(docs/research/data-sources-global.md §2) 본 시나리오는 Baa − 10년 국채를 투자등급 스프레드 프록시로 쓴다',
  },
  {
    id: 'bfs-gdp-2022',
    title:
      'Bruttoinlandprodukt nach Verwendungsarten (Tabelle T 04.02.01.02) — 명목 GDP, 1995~2022년판',
    publisher: 'Bundesamt für Statistik (BFS), Schweiz',
    date: '2023-08-24',
    url: 'https://www.bfs.admin.ch/asset/de/27065033',
    kind: 'data',
    note:
      '`B.1*b Bruttoinlandprodukt` 행, "In Mio. Franken, zu laufenden Preisen". 2022년 = ' +
      '**781,460백만 프랑**. **빈티지 주의**: 1995~2023년판은 791,087, 벤치마크 개정 후 ' +
      '1995~2025년판(2026-08-25 공표, `.../asset/de/ts-x-04.02.01.02`)은 819,704백만이다. ' +
      'SECO 계열(scheduler.swissdatas.ch/scheduled/ch-seco-gdp.csv, structure=gdp·type=nom)도 ' +
      '현행 빈티지와 소수점까지 일치한다. 이 시나리오는 2023년 3월에 알 수 있었던 값을 쓰므로 ' +
      '781을 유지하고 빈티지를 명시한다',
  },
  {
    id: 'efv-schuldenquote',
    title:
      '「Kennzahlen der öffentlichen Finanzen im internationalen Vergleich」 데이터셋 (지표 `schuldenquote` = 마스트리흐트 총부채/GDP)',
    publisher: 'Eidgenössische Finanzverwaltung (EFV) — Finanzstatistik',
    date: '2026-08-27',
    url: 'https://www.data.finance.admin.ch/static/assets/datasets/gfs_dashboard/kennz_int.csv',
    kind: 'data',
    note:
      '직접 조회 확인(2026-09). CHE `schuldenquote`: 2016 **27.51** · 2017 27.09 · 2018 25.15 · ' +
      '2019 24.61 · 2020 27.15 · 2021 25.65 · **2022 24.55** · 2023 24.31 · 2024 23.93. ' +
      '**종전 코드의 27.5%는 2022년이 아니라 2016년 값이다.** 마스트리흐트 총부채 수준은 ' +
      '`staat-d.xlsx` 시트 `schuld`의 "Maastricht-Schuld" 2022년 CHF 197,039백만이며, ' +
      'IMF 정의의 `fremdkapitalquote`(2022년 39.15%)와는 다른 지표다. GDP 개정에 따라 소급 ' +
      '수정되므로 빈티지를 함께 적는다(2025-08 스냅숏의 2022년 값은 25.9%였다)',
  },
  {
    id: 'fred-dexszus',
    title: 'FRED 계열 DEXSZUS — Swiss Francs to One U.S. Dollar, Spot (일별, 연준 H.10)',
    publisher: 'Federal Reserve Board (H.10) / Federal Reserve Bank of St. Louis (FRED)',
    date: '2023-03',
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXSZUS',
    kind: 'data',
    note:
      '직접 조회 확인. 2023-03-10 0.9213 · **03-13 0.9118** · 03-14 0.9137 · 03-15 0.9243 · 03-16 0.9299 · ' +
      '03-17 0.9284. 뉴욕 정오 매입환율(H.10)이며 SNB 월계열 devkum(2023-03 월평균 0.92552 · 월말 0.91625)과 ' +
      '정합적이다',
  },
  {
    id: 'fred-dgs',
    title: 'FRED 계열 DGS2 · DGS10 · DGS30 · VIXCLS (일별)',
    publisher: 'Federal Reserve Bank of St. Louis (FRED)',
    date: '2023-03',
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2,DGS10,DGS30,VIXCLS',
    kind: 'data',
    note: '직접 조회 확인. 2023-03-13: 2년 4.03 · 10년 3.55 · 30년 3.70 · VIX 26.52. 03-15: 3.93 / 3.51 / 3.70 / 26.14. 03-17: 3.81 / 3.39 / 3.60 / 25.51. 03-20: 3.92 / 3.47 / 3.65 / 24.15',
  },

  // ───────── 언론 (시각·발언·주가 전용) ─────────
  {
    id: 'press-snb-chairman-2023-03-15',
    title: 'Credit Suisse’s biggest backer says can’t put up more cash; shares down by a fifth',
    publisher: 'Reuters',
    date: '2023-03-15',
    kind: 'press',
    note: 'FINMA 2023.12 보고서가 각주 28로 인용하는 보도. 사우디국립은행(Saudi National Bank) 회장이 규제상의 이유로 크레디트스위스에 추가 출자할 수 없다고 밝힌 발언이 3월 15일 오전 시장에 전해졌다. 발언 자체는 기록이지만 본 시나리오의 모든 대사는 재구성이다',
  },
  {
    id: 'press-cs-share-2023-03',
    title: '2023년 3월 크레디트스위스 주가·시장 반응 보도 (종합)',
    publisher: 'CNBC · NPR · Reuters 외 복수 언론',
    date: '2023-03',
    kind: 'press',
    note: '[VERIFY] 주가 종가 계열은 언론 보도로만 확인했다 — 3/15 기록적 급락(장중 −30%대), 3/16 SNB 500억 프랑 발표 후 개장 +30%·종가 +18.8%, 3/17 종가 0.76프랑이 아닌 1.86프랑, 3/19 인수 대가 주당 0.76프랑, 3/20 −55%대. 게임의 주가 계열은 이 일별 변동률을 2023-03-13 종가 = 100으로 정규화한 것이며 절대 가격을 쓰지 않는다. 해소 문서: SIX Swiss Exchange 「Historical price list」 CSGN(ISIN CH0012138530) 일별 종가 CSV, 또는 UBS-CS 합병 신고서의 주가 부록',
  },
]
