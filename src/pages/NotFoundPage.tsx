import { Link, useLocation } from 'react-router-dom'
import { EmptyState } from '../components/ui'

export default function NotFoundPage() {
  const loc = useLocation()
  return (
    <EmptyState headingLevel={1} title="페이지를 찾을 수 없습니다">
      <code className="font-mono">{loc.pathname}</code> 경로가 없습니다.{' '}
      <Link to="/">카탈로그로 돌아가기</Link>
    </EmptyState>
  )
}
