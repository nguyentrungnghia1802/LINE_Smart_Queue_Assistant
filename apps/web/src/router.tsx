import { createBrowserRouter } from 'react-router-dom';

import { RootLayout } from './components/layout/RootLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QueueDetailPage } from './pages/QueueDetailPage';
import { QueuesPage } from './pages/QueuesPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'queues', element: <QueuesPage /> },
      { path: 'queues/:id', element: <QueueDetailPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
