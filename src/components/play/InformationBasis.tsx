import type { EventInformation } from '../../engine'

export function InformationBasis({ information }: { information?: EventInformation }) {
  if (!information) return null
  return (
    <p className="mt-1 text-xs text-muted">
      {information.basis === 'public' ? '공개 자료' : '훈련 재구성'}
      {information.note ? ` · ${information.note}` : ''}
    </p>
  )
}
