import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LiffLayout } from './components/layout/LiffLayout';
import { RootLayout } from './components/layout/RootLayout';
import { DashboardPage } from './pages/DashboardPage';
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
      // Default LIFF landing — shows a brief loader then redirects contextually
      { index: true, element: <LiffInitPage /> },
      // Join a specific queue (linked from QR code or LINE message)
      { path: 'join/:queueId', element: <QueueJoinPage /> },
      // My active tickets across all queues
      { path: 'tickets', element: <MyTicketsPage /> },
      // Single ticket detail + live ETA
      { path: 'tickets/:entryId', element: <TicketStatusPage /> },
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
  // Keeps old /dashboard links working if bookmarked
  { path: '/dashboard', element: <Navigate to="/" replace /> },

  // ── 404 ───────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
