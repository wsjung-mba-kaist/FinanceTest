/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createHashRouter, Outlet } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'

const HomePage = lazy(() => import('../pages/HomePage'))
const BriefingPage = lazy(() => import('../pages/BriefingPage'))
const PlayPage = lazy(() => import('../pages/PlayPage'))
const DebriefPage = lazy(() => import('../pages/DebriefPage'))
const KnowledgeIndexPage = lazy(() => import('../pages/KnowledgeIndexPage'))
const FrameworkPage = lazy(() => import('../pages/FrameworkPage'))
const GlossaryPage = lazy(() => import('../pages/GlossaryPage'))
const ReadingListPage = lazy(() => import('../pages/ReadingListPage'))
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

function Layout() {
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </AppShell>
  )
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'scenarios/:scenarioId', element: <BriefingPage /> },
      { path: 'play/:scenarioId', element: <PlayPage /> },
      { path: 'debrief/:scenarioId', element: <DebriefPage /> },
      { path: 'knowledge', element: <KnowledgeIndexPage /> },
      { path: 'knowledge/frameworks/:frameworkId', element: <FrameworkPage /> },
      { path: 'knowledge/glossary', element: <GlossaryPage /> },
      { path: 'knowledge/reading', element: <ReadingListPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'dev/scenario/:scenarioId', element: <DevScenarioInspectorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
