import { createBrowserRouter, Navigate, redirect } from 'react-router-dom';

import { LiffLayout } from './components/layout/LiffLayout';
import { AccountLifecyclePage } from './pages/AccountLifecyclePage';
import { AccountPage } from './pages/AccountPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOrganizationApplicationsPage } from './pages/admin/AdminOrganizationApplicationsPage';
import { AdminOrganizationDetailPage } from './pages/admin/AdminOrganizationDetailPage';
import { AdminOrganizationsPage } from './pages/admin/AdminOrganizationsPage';
import { CustomerLineEntryPage, LiffCustomerJoinPage } from './pages/customer/CustomerJoinPage';
import { HistoryPage } from './pages/liff/HistoryPage';
import { HomePage } from './pages/liff/HomePage';
import { LiffInitPage } from './pages/liff/LiffInitPage';
import { MyTicketsPage } from './pages/liff/MyTicketsPage';
import { PreferencesPage } from './pages/liff/PreferencesPage';
import { QueueJoinPage } from './pages/liff/QueueJoinPage';
import { TicketStatusPage } from './pages/liff/TicketStatusPage';
import { LoginPage } from './pages/LoginPage';
import { CreateQueuePage } from './pages/manager/CreateQueuePage';
import { ManagerAuditPage } from './pages/manager/ManagerAuditPage';
import { ManagerBranchDetailPage } from './pages/manager/ManagerBranchDetailPage';
import { ManagerBranchesPage } from './pages/manager/ManagerBranchesPage';
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { ManagerLayout } from './pages/manager/ManagerLayout';
import { ManagerProductDetailPage } from './pages/manager/ManagerProductDetailPage';
import { ManagerProductFormPage } from './pages/manager/ManagerProductFormPage';
import { ManagerProductsPage } from './pages/manager/ManagerProductsPage';
import { ManagerQRPage } from './pages/manager/ManagerQRPage';
import { ManagerSettingsRoute } from './pages/manager/ManagerSettingsRoute';
import { ManagerUserDetailPage } from './pages/manager/ManagerUserDetailPage';
import { ManagerUsersPage } from './pages/manager/ManagerUsersPage';
import { QueueSettingsPage } from './pages/manager/QueueSettingsPage';
import { BusinessRegistrationPage } from './pages/marketing/BusinessRegistrationPage';
import { MarketingHomePage } from './pages/marketing/MarketingHomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PaymentDemoPage } from './pages/PaymentDemoPage';
import { QueueDetailPage } from './pages/QueueDetailPage';
import { QueuesPage } from './pages/QueuesPage';
import { RoleRedirectPage } from './pages/RoleRedirectPage';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage';
import { StaffLayout } from './pages/staff/StaffLayout';
import { StaffProductsPage } from './pages/staff/StaffProductsPage';
import { StaffQRPage } from './pages/staff/StaffQRPage';
import { StaffQueuePage } from './pages/StaffQueuePage';

export const router = createBrowserRouter([
  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/business/register',
    element: <BusinessRegistrationPage />,
  },
  {
    path: '/account',
    element: <AccountPage />,
  },
  { path: '/activate-account', element: <AccountLifecyclePage /> },
  { path: '/forgot-password', element: <AccountLifecyclePage /> },
  { path: '/reset-password', element: <AccountLifecyclePage /> },

  // ── Public (no auth required) ─────────────────────────────────────────────
  {
    path: '/join/:queueId',
    loader: ({ params }) => redirect(`/liff/join/${encodeURIComponent(params.queueId ?? '')}`),
  },
  {
    path: '/ticket/:entryId',
    loader: ({ params }) => redirect(`/liff/tickets/${encodeURIComponent(params.entryId ?? '')}`),
  },
  { path: '/checkout/demo/:sessionId', element: <PaymentDemoPage /> },
  { path: '/q/:orgSlug', element: <CustomerLineEntryPage /> },
  { path: '/qr/:token', element: <CustomerLineEntryPage /> },

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
      { path: 'queues', element: <QueuesPage /> },
      { path: 'queues/new', element: <CreateQueuePage /> },
      { path: 'queues/:id', element: <QueueDetailPage /> },
      { path: 'queues/:id/manage', element: <StaffQueuePage /> },
      { path: 'queues/:id/settings', element: <QueueSettingsPage /> },
      { path: 'users', element: <ManagerUsersPage /> },
      { path: 'users/:userId', element: <ManagerUserDetailPage /> },
      { path: 'branches', element: <ManagerBranchesPage /> },
      { path: 'branches/:branchId', element: <ManagerBranchDetailPage /> },
      { path: 'audit', element: <ManagerAuditPage /> },
      { path: 'qr', element: <ManagerQRPage /> },
      { path: 'settings', element: <ManagerSettingsRoute /> },
    ],
  },

  // ── Staff ─────────────────────────────────────────────────────────────────
  {
    path: '/staff',
    element: <StaffLayout />,
    children: [
      { index: true, element: <StaffDashboardPage /> },
      { path: 'products', element: <StaffProductsPage /> },
      { path: 'qr', element: <StaffQRPage /> },
    ],
  },

  // Keep old bookmarks working while customer functionality remains LINE/LIFF-only.
  { path: '/customer', element: <Navigate to="/liff/home" replace /> },

  // ── LIFF customer flow ────────────────────────────────────────────────────
  {
    path: '/liff',
    element: <LiffLayout />,
    children: [
      { index: true, element: <LiffInitPage /> },
      { path: 'home', element: <HomePage /> },
      { path: 'join/:queueId', element: <QueueJoinPage /> },
      { path: 'q/:orgSlug', element: <LiffCustomerJoinPage /> },
      { path: 'qr/:token', element: <LiffCustomerJoinPage /> },
      { path: 'checkout/demo/:sessionId', element: <PaymentDemoPage /> },
      { path: 'tickets', element: <MyTicketsPage /> },
      { path: 'tickets/:entryId', element: <TicketStatusPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'preferences', element: <PreferencesPage /> },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'orgs', element: <AdminOrganizationsPage /> },
      { path: 'applications', element: <AdminOrganizationApplicationsPage /> },
      { path: 'orgs/:orgId', element: <AdminOrganizationDetailPage /> },
    ],
  },

  // ── Staff / manager dashboard ─────────────────────────────────────────────
  {
    path: '/',
    element: <MarketingHomePage />,
  },

  { path: '/app/*', element: <Navigate to="/dashboard" replace /> },

  // ── Convenience redirect ──────────────────────────────────────────────────
  { path: '/dashboard', element: <RoleRedirectPage /> },

  // ── 404 ───────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
