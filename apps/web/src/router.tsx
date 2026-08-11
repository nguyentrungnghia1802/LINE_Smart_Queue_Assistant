import { type ComponentType, createElement, lazy } from 'react';
import { createBrowserRouter, Navigate, redirect, type RouteObject } from 'react-router-dom';

function lazyElement<TModule, TKey extends keyof TModule>(
  load: () => Promise<TModule>,
  exportName: TKey
) {
  const Component = lazy(async () => ({ default: (await load())[exportName] as ComponentType }));
  return createElement(Component);
}

export const appRoutes = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: lazyElement(() => import('./pages/LoginPage'), 'LoginPage'),
  },
  {
    path: '/register',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/business/register',
    element: lazyElement(
      () => import('./pages/marketing/BusinessRegistrationPage'),
      'BusinessRegistrationPage'
    ),
  },
  {
    path: '/account',
    element: lazyElement(() => import('./pages/AccountPage'), 'AccountPage'),
  },
  {
    path: '/activate-account',
    element: lazyElement(() => import('./pages/AccountLifecyclePage'), 'AccountLifecyclePage'),
  },
  {
    path: '/forgot-password',
    element: lazyElement(() => import('./pages/AccountLifecyclePage'), 'AccountLifecyclePage'),
  },
  {
    path: '/reset-password',
    element: lazyElement(() => import('./pages/AccountLifecyclePage'), 'AccountLifecyclePage'),
  },

  // ── Public (no auth required) ─────────────────────────────────────────────
  {
    path: '/join/:queueId',
    loader: ({ params }) => redirect(`/liff/join/${encodeURIComponent(params.queueId ?? '')}`),
  },
  {
    path: '/ticket/:entryId',
    loader: ({ params }) => redirect(`/liff/tickets/${encodeURIComponent(params.entryId ?? '')}`),
  },
  {
    path: '/checkout/demo/:sessionId',
    element: lazyElement(() => import('./pages/PaymentDemoPage'), 'PaymentDemoPage'),
  },
  {
    path: '/q/:orgSlug',
    element: lazyElement(
      () => import('./pages/customer/CustomerJoinPage'),
      'CustomerLineEntryPage'
    ),
  },
  {
    path: '/qr/:token',
    element: lazyElement(
      () => import('./pages/customer/CustomerJoinPage'),
      'CustomerLineEntryPage'
    ),
  },

  // ── Manager ───────────────────────────────────────────────────────────────
  {
    path: '/manager',
    element: lazyElement(() => import('./pages/manager/ManagerLayout'), 'ManagerLayout'),
    children: [
      {
        index: true,
        element: lazyElement(
          () => import('./pages/manager/ManagerDashboardPage'),
          'ManagerDashboardPage'
        ),
      },
      {
        path: 'products',
        element: lazyElement(
          () => import('./pages/manager/ManagerProductsPage'),
          'ManagerProductsPage'
        ),
      },
      {
        path: 'products/new',
        element: lazyElement(
          () => import('./pages/manager/ManagerProductFormPage'),
          'ManagerProductFormPage'
        ),
      },
      {
        path: 'products/:id',
        element: lazyElement(
          () => import('./pages/manager/ManagerProductDetailPage'),
          'ManagerProductDetailPage'
        ),
      },
      {
        path: 'products/:id/edit',
        element: lazyElement(
          () => import('./pages/manager/ManagerProductFormPage'),
          'ManagerProductFormPage'
        ),
      },
      {
        path: 'queues',
        element: lazyElement(() => import('./pages/QueuesPage'), 'QueuesPage'),
      },
      {
        path: 'queues/new',
        element: lazyElement(() => import('./pages/manager/CreateQueuePage'), 'CreateQueuePage'),
      },
      {
        path: 'queues/:id',
        element: lazyElement(() => import('./pages/QueueDetailPage'), 'QueueDetailPage'),
      },
      {
        path: 'queues/:id/manage',
        element: lazyElement(() => import('./pages/StaffQueuePage'), 'StaffQueuePage'),
      },
      {
        path: 'queues/:id/settings',
        element: lazyElement(
          () => import('./pages/manager/QueueSettingsPage'),
          'QueueSettingsPage'
        ),
      },
      {
        path: 'users',
        element: lazyElement(() => import('./pages/manager/ManagerUsersPage'), 'ManagerUsersPage'),
      },
      {
        path: 'users/:userId',
        element: lazyElement(
          () => import('./pages/manager/ManagerUserDetailPage'),
          'ManagerUserDetailPage'
        ),
      },
      {
        path: 'branches',
        element: lazyElement(
          () => import('./pages/manager/ManagerBranchesPage'),
          'ManagerBranchesPage'
        ),
      },
      {
        path: 'branches/:branchId',
        element: lazyElement(
          () => import('./pages/manager/ManagerBranchDetailPage'),
          'ManagerBranchDetailPage'
        ),
      },
      {
        path: 'audit',
        element: lazyElement(() => import('./pages/manager/ManagerAuditPage'), 'ManagerAuditPage'),
      },
      {
        path: 'notifications',
        element: lazyElement(
          () => import('./pages/NotificationOperationsPage'),
          'NotificationOperationsPage'
        ),
      },
      {
        path: 'qr',
        element: lazyElement(() => import('./pages/manager/ManagerQRPage'), 'ManagerQRPage'),
      },
      {
        path: 'settings',
        element: lazyElement(
          () => import('./pages/manager/ManagerSettingsRoute'),
          'ManagerSettingsRoute'
        ),
      },
    ],
  },

  // ── Staff ─────────────────────────────────────────────────────────────────
  {
    path: '/staff',
    element: lazyElement(() => import('./pages/staff/StaffLayout'), 'StaffLayout'),
    children: [
      {
        index: true,
        element: lazyElement(
          () => import('./pages/staff/StaffDashboardPage'),
          'StaffDashboardPage'
        ),
      },
      {
        path: 'products',
        element: lazyElement(() => import('./pages/staff/StaffProductsPage'), 'StaffProductsPage'),
      },
      {
        path: 'qr',
        element: lazyElement(() => import('./pages/staff/StaffQRPage'), 'StaffQRPage'),
      },
      {
        path: 'notifications',
        element: lazyElement(
          () => import('./pages/NotificationOperationsPage'),
          'NotificationOperationsPage'
        ),
      },
    ],
  },

  // Keep old bookmarks working while customer functionality remains LINE/LIFF-only.
  { path: '/customer', element: <Navigate to="/liff/home" replace /> },

  // ── LIFF customer flow ────────────────────────────────────────────────────
  {
    path: '/liff',
    element: lazyElement(() => import('./components/layout/LiffLayout'), 'LiffLayout'),
    children: [
      {
        index: true,
        element: lazyElement(() => import('./pages/liff/LiffInitPage'), 'LiffInitPage'),
      },
      {
        path: 'home',
        element: lazyElement(() => import('./pages/liff/HomePage'), 'HomePage'),
      },
      {
        path: 'join/:queueId',
        element: lazyElement(() => import('./pages/liff/QueueJoinPage'), 'QueueJoinPage'),
      },
      {
        path: 'q/:orgSlug',
        element: lazyElement(
          () => import('./pages/customer/CustomerJoinPage'),
          'LiffCustomerJoinPage'
        ),
      },
      {
        path: 'qr/:token',
        element: lazyElement(
          () => import('./pages/customer/CustomerJoinPage'),
          'LiffCustomerJoinPage'
        ),
      },
      {
        path: 'checkout/demo/:sessionId',
        element: lazyElement(() => import('./pages/PaymentDemoPage'), 'PaymentDemoPage'),
      },
      {
        path: 'tickets',
        element: lazyElement(() => import('./pages/liff/MyTicketsPage'), 'MyTicketsPage'),
      },
      {
        path: 'tickets/:entryId',
        element: lazyElement(() => import('./pages/liff/TicketStatusPage'), 'TicketStatusPage'),
      },
      {
        path: 'history',
        element: lazyElement(() => import('./pages/liff/HistoryPage'), 'HistoryPage'),
      },
      {
        path: 'preferences',
        element: lazyElement(() => import('./pages/liff/PreferencesPage'), 'PreferencesPage'),
      },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    path: '/admin',
    element: lazyElement(() => import('./pages/admin/AdminLayout'), 'AdminLayout'),
    children: [
      {
        index: true,
        element: lazyElement(
          () => import('./pages/admin/AdminDashboardPage'),
          'AdminDashboardPage'
        ),
      },
      {
        path: 'orgs',
        element: lazyElement(
          () => import('./pages/admin/AdminOrganizationsPage'),
          'AdminOrganizationsPage'
        ),
      },
      {
        path: 'applications',
        element: lazyElement(
          () => import('./pages/admin/AdminOrganizationApplicationsPage'),
          'AdminOrganizationApplicationsPage'
        ),
      },
      {
        path: 'operations',
        element: lazyElement(
          () => import('./pages/admin/AdminOperationsPage'),
          'AdminOperationsPage'
        ),
      },
      {
        path: 'orgs/:orgId',
        element: lazyElement(
          () => import('./pages/admin/AdminOrganizationDetailPage'),
          'AdminOrganizationDetailPage'
        ),
      },
    ],
  },

  // ── Staff / manager dashboard ─────────────────────────────────────────────
  {
    path: '/',
    element: lazyElement(() => import('./pages/marketing/MarketingHomePage'), 'MarketingHomePage'),
  },

  { path: '/app/*', element: <Navigate to="/dashboard" replace /> },

  // ── Convenience redirect ──────────────────────────────────────────────────
  {
    path: '/dashboard',
    element: lazyElement(() => import('./pages/RoleRedirectPage'), 'RoleRedirectPage'),
  },

  // ── 404 ───────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: lazyElement(() => import('./pages/NotFoundPage'), 'NotFoundPage'),
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(appRoutes);
