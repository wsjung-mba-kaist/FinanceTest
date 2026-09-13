import type { BankFundingPlan } from '../../engine/types'

/** The hourly split is a training assumption, not an observed SVB payment ledger. */
export const svbFundingPlan: BankFundingPlan = {
  windows: [
    {
      turnId: 't3',
      effectId: 't3-runoff-tick',
      assumption:
        '오전 구간의 시간별 배분은 훈련 가정입니다. 현재 예금·인출 성향이 유지될 때 남은 오전 구간만 추정합니다.',
      sourceRefs: ['fed-svb-review-2023'],
    },
    {
      turnId: 't4',
      effectId: 't4-runoff-tick',
      assumption:
        '오후 구간의 시간별 배분은 훈련 가정입니다. 현재 예금·인출 성향이 유지될 때 남은 오후 구간만 추정합니다.',
      sourceRefs: ['fed-svb-review-2023', 'dfpi-order-2023-03-10'],
    },
  ],
  pendingCapacity: {
    at: { turnId: 't6', tick: 0 },
    effectId: 't6-settle',
    condition:
      '이전 완료 후 차입 한도로 반영되며, 현금 사용에는 인출이 필요합니다. 야간 지원 결정은 반영을 앞당길 수 있고, 담보 이관 미완료는 금액을 줄일 수 있습니다.',
    sourceRefs: ['fed-svb-review-2023'],
  },
  checkpoints: [
    {
      id: 'thursday-close',
      title: '목요일 마감 잔고 점검',
      knownFrom: { turnId: 't3', tick: 0 },
      at: { turnId: 't5', tick: 0 },
      balanceAt: { turnId: 't4', tick: 4 },
      note: '17:00은 훈련의 마감 점검 시각입니다. 앞서 반영한 예금 유출을 다시 차감하지 않습니다. 개별 송금·cash letter의 확정 금액과 실제 결제 마감은 별도 확인이 필요합니다.',
      sourceRefs: ['dfpi-order-2023-03-10', 'fed-svb-review-2023'],
    },
  ],
}
