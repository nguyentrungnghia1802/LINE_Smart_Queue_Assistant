import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LiffLayout } from './components/layout/LiffLayout';
import { RootLayout } from './components/layout/RootLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOrgsPage } from './pages/admin/AdminOrgsPage';
import { CustomerJoinPage } from './pages/customer/CustomerJoinPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/liff/HistoryPage';
import { HomePage } from './pages/liff/HomePage';
import { LiffInitPage } from './pages/liff/LiffInitPage';
import { MyTicketsPage } from './pages/liff/MyTicketsPage';
import { QueueJoinPage } from './pages/liff/QueueJoinPage';
import { TicketStatusPage } from './pages/liff/TicketStatusPage';
import { LoginPage } from './pages/LoginPage';
import { CreateQueuePage } from './pages/manager/CreateQueuePage';
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { ManagerLayout } from './pages/manager/ManagerLayout';
import { ManagerProductDetailPage } from './pages/manager/ManagerProductDetailPage';
import { ManagerProductFormPage } from './pages/manager/ManagerProductFormPage';
import { ManagerProductsPage } from './pages/manager/ManagerProductsPage';
import { ManagerQRPage } from './pages/manager/ManagerQRPage';
import { ManagerSettingsPage } from './pages/manager/ManagerSettingsPage';
import { ManagerUsersPage } from './pages/manager/ManagerUsersPage';
import { QRDisplayPage } from './pages/manager/QRDisplayPage';
import { QueueSettingsPage } from './pages/manager/QueueSettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PublicJoinPage } from './pages/public/PublicJoinPage';
import { PublicTicketPage } from './pages/public/PublicTicketPage';
import { QueueDetailPage } from './pages/QueueDetailPage';
import { QueuesPage } from './pages/QueuesPage';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage';
import { StaffLayout } from './pages/staff/StaffLayout';
import { StaffProductsPage } from './pages/staff/StaffProductsPage';
import { StaffQueuePage } from './pages/StaffQueuePage';

export const router = createBrowserRouter([
  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── Public (no auth required) ─────────────────────────────────────────────
  { path: '/join/:queueId', element: <PublicJoinPage /> },
  { path: '/ticket/:entryId', element: <PublicTicketPage /> },
  { path: '/q/:orgSlug', element: <CustomerJoinPage /> },
  { path: '/qr/:token', element: <CustomerJoinPage /> },

  // ── Manager ───────────────────────────────────────────────────────────────
  {
    path: '/manager',
    element: <ManagerLayout />,
    children: [
      { index: true, element: <ManagerDashboardPage /> },
      { path: 'products', element: <ManagerProductsPage /> },
      { path: 'products/new', element: <ManagerProductFormPage /> },
      { path: 'products/:id', element: <ManagerProductDetailPage /> },
      { path: 'products/:id/edit', element: <ManagerProductFormPage /> },
      { path: 'users', element: <ManagerUsersPage /> },
      { path: 'qr', element: <ManagerQRPage /> },
      { path: 'settings', element: <ManagerSettingsPage /> },
    ],
  },

  // ── Staff ─────────────────────────────────────────────────────────────────
  {
    path: '/staff',
    element: <StaffLayout />,
    children: [
      { index: true, element: <StaffDashboardPage /> },
      { path: 'products', element: <StaffProductsPage /> },
    ],
  },

  // ── LIFF customer flow ────────────────────────────────────────────────────
  {
    path: '/liff',
    element: <LiffLayout />,
    children: [
      { index: true, element: <LiffInitPage /> },
      { path: 'home', element: <HomePage /> },
      { path: 'join/:queueId', element: <QueueJoinPage /> },
      { path: 'tickets', element: <MyTicketsPage /> },
      { path: 'tickets/:entryId', element: <TicketStatusPage /> },
      { path: 'history', element: <HistoryPage /> },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'orgs', element: <AdminOrgsPage /> },
    ],
  },

  // ── Staff / manager dashboard ─────────────────────────────────────────────
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'queues', element: <QueuesPage /> },
      { path: 'queues/new', element: <CreateQueuePage /> },
      { path: 'queues/:id', element: <QueueDetailPage /> },
      { path: 'queues/:id/display', element: <QRDisplayPage /> },
      { path: 'queues/:id/settings', element: <QueueSettingsPage /> },
      { path: 'staff/queues/:queueId', element: <StaffQueuePage /> },
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
