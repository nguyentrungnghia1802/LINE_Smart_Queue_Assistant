import '../src/index.css';

/* eslint-disable react-refresh/only-export-components -- Storybook preview exports config and providers. */
import type { Decorator, Preview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { i18n } from '../src/i18n';

const localeItems = [
  { value: 'ja', title: '日本語' },
  { value: 'vi', title: 'Tiếng Việt' },
  { value: 'en', title: 'English' },
];

const viewportOptions = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
};

interface StoryRouterParameters {
  initialEntries?: string[];
}

function StoryProviders({
  locale,
  initialEntries,
  children,
}: {
  locale: string;
  initialEntries: string[];
  children: ReactNode;
}) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
    []
  );

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

const withProviders: Decorator = (Story, context) => {
  const router = (context.parameters.router ?? {}) as StoryRouterParameters;
  return (
    <StoryProviders
      locale={String(context.globals.locale ?? 'ja')}
      initialEntries={router.initialEntries ?? ['/']}
    >
      <Story />
    </StoryProviders>
  );
};

const preview: Preview = {
  decorators: [withProviders],
  globalTypes: {
    locale: {
      description: 'Visible application locale',
      defaultValue: 'ja',
      toolbar: {
        icon: 'globe',
        items: localeItems,
      },
    },
  },
  initialGlobals: {
    locale: 'ja',
    viewport: { value: 'desktop', isRotated: false },
  },
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    options: {
      storySort: {
        order: ['Brand', 'UI', 'Layout', 'Queue', 'Ticket', 'Manager', 'LIFF'],
      },
    },
    viewport: { options: viewportOptions },
  },
};

export default preview;
