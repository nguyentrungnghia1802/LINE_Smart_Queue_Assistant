import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LiffLayout } from './components/layout/LiffLayout';
import { RootLayout } from './components/layout/RootLayout';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/liff/HistoryPage';
import { HomePage } from './pages/liff/HomePage';
import { LiffInitPage } from './pages/liff/LiffInitPage';
import { MyTicketsPage } from './pages/liff/MyTicketsPage';
import { QueueJoinPage } from './pages/liff/QueueJoinPage';
import { TicketStatusPage } from './pages/liff/TicketStatusPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QueueDetailPage } from './pages/QueueDetailPage';
import { QueuesPage } from './pages/QueuesPage';

export const router = createBrowserRouter([
  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── LIFF customer flow ────────────────────────────────────────────────────
  // All routes under /liff/* share the LiffLayout which handles SDK init.
  {
    path: '/liff',
    element: <LiffLayout />,
    children: [
      // Default LIFF landing — redirects to /liff/home
      { index: true, element: <LiffInitPage /> },
      // Home / introduction screen
      { path: 'home', element: <HomePage /> },
      // Join a specific queue (linked from QR code or LINE message)
      { path: 'join/:queueId', element: <QueueJoinPage /> },
      // My active tickets across all queues
      { path: 'tickets', element: <MyTicketsPage /> },
      // Single ticket detail + live ETA
      { path: 'tickets/:entryId', element: <TicketStatusPage /> },
      // History placeholder
      { path: 'history', element: <HistoryPage /> },
    ],
  },

  // ── Admin / staff dashboard ───────────────────────────────────────────────
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'queues', element: <QueuesPage /> },
      { path: 'queues/:id', element: <QueueDetailPage /> },
    ],
  },

  // ── Convenience redirect ──────────────────────────────────────────────────
  { path: '/dashboard', element: <Navigate to="/" replace /> },

  // ── 404 ───────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
