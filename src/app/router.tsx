/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import {
  createHashRouter,
  isRouteErrorResponse,
  Link,
  Outlet,
  ScrollRestoration,
  useLocation,
  useRouteError,
} from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { HelpProvider } from '../components/help'
import type { HelpContextValue } from '../components/help/helpContext'

const HomePage = lazy(() => import('../pages/HomePage'))
const BriefingPage = lazy(() => import('../pages/BriefingPage'))
const PlayPage = lazy(() => import('../pages/PlayPage'))
const DebriefPage = lazy(() => import('../pages/DebriefPage'))
const KnowledgeIndexPage = lazy(() => import('../pages/KnowledgeIndexPage'))
const FrameworkPage = lazy(() => import('../pages/FrameworkPage'))
const GlossaryPage = lazy(() => import('../pages/GlossaryPage'))
const ReadingListPage = lazy(() => import('../pages/ReadingListPage'))
const DemoPage = lazy(() => import('../pages/DemoPage'))
const ProgressPage = lazy(() => import('../pages/ProgressPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const DevScenarioInspectorPage = lazy(() => import('../pages/DevScenarioInspectorPage'))

function Loading() {
  return (
    <div className="p-8 text-muted" role="status">
      불러오는 중…
    </div>
  )
}

/**
 * Keeps a render error inside the shell instead of blanking the app. Progress data lives in
 * localStorage and is untouched by a render failure, so the user can simply navigate away.
 */
function RouteErrorBody() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error ?? '')
  return (
    <div className="rounded-lg border border-critical/40 bg-critical-bg p-6">
      <h1 className="text-lg font-semibold text-critical">화면을 표시하지 못했습니다</h1>
      <p className="mt-2 text-base">
        저장된 진행 데이터는 그대로 있습니다. 아래 링크로 이동하거나 새로고침해 보세요.
      </p>
      {detail && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-surface-2 p-3 text-sm">{detail}</pre>
      )}
      <p className="mt-3 flex flex-wrap gap-3">
        <Link to="/">카탈로그로</Link>
        <Link to="/progress">진행 현황</Link>
        <Link to="/settings">설정</Link>
      </p>
    </div>
  )
}

/** Root-level failure: the shell itself did not render, so it is supplied here. */
function RootRouteError() {
  return (
    <AppShell>
      <RouteErrorBody />
    </AppShell>
  )
}

/**
 * Coarse help context for routes that do not supply a richer one themselves.
 * Play / briefing / debrief mount their own `HelpProvider` with the scenario and
 * run state, so the shell must not wrap them (two providers = two sheets).
 */
function shellHelpContext(pathname: string): HelpContextValue | null {
  if (
    pathname.startsWith('/play/') ||
    pathname.startsWith('/scenarios/') ||
    pathname.startsWith('/debrief/')
  )
    return null
  if (pathname.startsWith('/knowledge')) return { page: 'knowledge' }
  if (pathname.startsWith('/demo')) return { page: 'other' }
  if (pathname.startsWith('/progress')) return { page: 'progress' }
  if (pathname.startsWith('/settings')) return { page: 'settings' }
  if (pathname === '/') return { page: 'catalog' }
  return { page: 'other' }
}

function Layout() {
  const { pathname } = useLocation()
  const helpContext = shellHelpContext(pathname)
  const body = (
    <AppShell>
      <ScrollRestoration />
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </AppShell>
  )
  return helpContext ? <HelpProvider context={helpContext}>{body}</HelpProvider> : body
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RootRouteError />,
    children: [
      { index: true, element: <HomePage />, errorElement: <RouteErrorBody /> },
      {
        path: 'scenarios/:scenarioId',
        element: <BriefingPage />,
        errorElement: <RouteErrorBody />,
      },
      { path: 'play/:scenarioId', element: <PlayPage />, errorElement: <RouteErrorBody /> },
      { path: 'debrief/:scenarioId', element: <DebriefPage />, errorElement: <RouteErrorBody /> },
      { path: 'knowledge', element: <KnowledgeIndexPage />, errorElement: <RouteErrorBody /> },
      {
        path: 'knowledge/frameworks/:frameworkId',
        element: <FrameworkPage />,
        errorElement: <RouteErrorBody />,
      },
      { path: 'knowledge/glossary', element: <GlossaryPage />, errorElement: <RouteErrorBody /> },
      { path: 'knowledge/reading', element: <ReadingListPage />, errorElement: <RouteErrorBody /> },
      { path: 'demo', element: <DemoPage />, errorElement: <RouteErrorBody /> },
      { path: 'progress', element: <ProgressPage />, errorElement: <RouteErrorBody /> },
      { path: 'settings', element: <SettingsPage />, errorElement: <RouteErrorBody /> },
      {
        path: 'dev/scenario/:scenarioId',
        element: <DevScenarioInspectorPage />,
        errorElement: <RouteErrorBody />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
