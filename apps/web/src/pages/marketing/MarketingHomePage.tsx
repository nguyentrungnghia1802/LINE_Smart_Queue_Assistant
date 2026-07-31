import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  Clock3,
  HeartPulse,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Scissors,
  ShoppingBag,
  Store,
  Utensils,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { BrandLogo } from '../../components/BrandLogo';
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { useAuthStore } from '../../store/authStore';

const PLAN_PRICES = { starter: 9_800, standard: 29_800, scale: 59_800 } as const;

export function MarketingHomePage() {
  const { t, i18n } = useTranslation(['marketing', 'common']);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const currency = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ja', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  });

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <BrandLogo className="h-9 w-9" />
            <span className="truncate text-sm font-bold sm:text-base">Smart Queue Assistant</span>
          </Link>
          <nav
            className="ml-4 hidden items-center gap-6 lg:flex"
            aria-label={t('accessibility.mainNavigation', { ns: 'common' })}
          >
            <a className="text-sm font-semibold text-gray-600 hover:text-gray-950" href="#product">
              {t('nav.product')}
            </a>
            <a
              className="text-sm font-semibold text-gray-600 hover:text-gray-950"
              href="#solutions"
            >
              {t('nav.solutions')}
            </a>
            <a className="text-sm font-semibold text-gray-600 hover:text-gray-950" href="#pricing">
              {t('nav.pricing')}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher compact />
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="hidden rounded-md border border-gray-300 px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 sm:inline-flex"
            >
              {isAuthenticated ? t('nav.dashboard') : t('nav.login')}
            </Link>
            <Link
              to="/business/register"
              className="rounded-md bg-gray-950 px-3 py-2 text-sm font-bold text-white hover:bg-gray-800"
            >
              <span className="hidden md:inline">{t('nav.businessSignup')}</span>
              <ArrowRight className="h-4 w-4 md:hidden" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setNavigationOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-700 lg:hidden"
              aria-label={t('nav.menu')}
              aria-expanded={navigationOpen}
            >
              {navigationOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {navigationOpen && (
          <nav
            className="border-t border-gray-200 bg-white px-4 py-3 lg:hidden"
            aria-label={t('accessibility.mainNavigation', { ns: 'common' })}
          >
            <div className="mx-auto grid max-w-7xl gap-1">
              {[
                ['#product', t('nav.product')],
                ['#solutions', t('nav.solutions')],
                ['#pricing', t('nav.pricing')],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setNavigationOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </a>
              ))}
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                onClick={() => setNavigationOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:hidden"
              >
                {isAuthenticated ? t('nav.dashboard') : t('nav.login')}
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section
          className="relative flex min-h-[calc(100svh-7rem)] items-end overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: "url('/img/landing-hero.webp')" }}
        >
          <div className="absolute inset-0 bg-gray-950/65" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-24 sm:px-6 sm:pb-20 lg:pb-24">
            <div className="max-w-3xl text-white">
              <p className="text-sm font-bold uppercase text-emerald-300">{t('hero.eyebrow')}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                {t('hero.title')}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-100 sm:text-lg">
                {t('hero.description')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/business/register"
                  className="inline-flex items-center gap-2 rounded-md bg-line-green px-5 py-3 text-sm font-bold text-white hover:bg-brand-600"
                >
                  {t('hero.primary')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#product"
                  className="rounded-md border border-white/70 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/20"
                >
                  {t('hero.secondary')}
                </a>
              </div>
              <p className="mt-7 flex items-center gap-2 text-sm text-gray-200">
                <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                {t('hero.trusted')}
              </p>
            </div>
          </div>
        </section>

        <RevealSection
          id="product"
          className="flex min-h-[82svh] scroll-mt-20 items-center border-b border-gray-200 bg-white py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase text-brand-700">{t('product.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{t('product.title')}</h2>
              <p className="mt-4 text-base leading-7 text-gray-600">{t('product.description')}</p>
            </div>
            <div className="mt-14 grid gap-3 md:grid-cols-3">
              <Feature
                icon={MessageCircle}
                title={t('product.features.line.title')}
                description={t('product.features.line.description')}
              />
              <Feature
                icon={Clock3}
                title={t('product.features.queue.title')}
                description={t('product.features.queue.description')}
              />
              <Feature
                icon={BarChart3}
                title={t('product.features.analytics.title')}
                description={t('product.features.analytics.description')}
              />
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="solutions"
          className="flex min-h-[82svh] scroll-mt-20 items-center bg-gray-950 py-20 text-white sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-sm font-bold uppercase text-emerald-300">{t('solutions.eyebrow')}</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
              {t('solutions.title')}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Solution icon={Scissors} label={t('solutions.salon')} />
              <Solution icon={HeartPulse} label={t('solutions.clinic')} />
              <Solution icon={Utensils} label={t('solutions.restaurant')} />
              <Solution icon={ShoppingBag} label={t('solutions.counter')} />
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="pricing"
          className="flex min-h-[90svh] scroll-mt-20 items-center bg-gray-50 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase text-brand-700">{t('pricing.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{t('pricing.title')}</h2>
              <p className="mt-4 text-sm text-gray-500">{t('pricing.demoNotice')}</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {(Object.keys(PLAN_PRICES) as Array<keyof typeof PLAN_PRICES>).map((plan) => (
                <article
                  key={plan}
                  className={`flex h-full flex-col rounded-lg border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                    plan === 'standard'
                      ? 'border-brand-500 shadow-[var(--shadow-soft)]'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex min-h-7 items-center justify-between gap-3">
                    <h3 className="text-xl font-bold">{t(`pricing.${plan}.name`)}</h3>
                    {plan === 'standard' && (
                      <span className="rounded bg-brand-100 px-2 py-1 text-xs font-bold text-brand-800">
                        {t('pricing.standard.badge')}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-gray-600">
                    {t(`pricing.${plan}.description`)}
                  </p>
                  <p className="mt-6 text-3xl font-bold">
                    {currency.format(PLAN_PRICES[plan])}
                    <span className="text-sm font-medium text-gray-500">
                      {t('pricing.perMonth')}
                    </span>
                  </p>
                  <ul className="mt-6 space-y-3">
                    {(t(`pricing.${plan}.features`, { returnObjects: true }) as string[]).map(
                      (feature) => (
                        <li key={feature} className="flex gap-2 text-sm text-gray-700">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                            aria-hidden="true"
                          />
                          {feature}
                        </li>
                      )
                    )}
                  </ul>
                  <Link
                    to={`/business/register?plan=${plan}`}
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-bold ${
                      plan === 'standard'
                        ? 'bg-gray-950 text-white hover:bg-gray-800'
                        : 'border border-gray-300 text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {t('pricing.choose')}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </RevealSection>

        <RevealSection className="border-y border-gray-200 bg-emerald-50 py-16 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold text-gray-950">{t('cta.title')}</h2>
              <p className="mt-3 text-gray-600">{t('cta.description')}</p>
            </div>
            <Link
              to="/business/register"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-gray-950 px-5 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              {t('cta.action')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </RevealSection>
      </main>

      <footer className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <BrandLogo className="h-11 w-11" />
                <span className="text-lg font-bold">Smart Queue Assistant</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600">{t('footer.description')}</p>
            </div>
            <address className="not-italic text-sm leading-6 text-gray-600 md:justify-self-end md:text-left">
              <p className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-700">
                {t('footer.contact')}
              </p>
              <a
                href="mailto:trungnghia180205@gmail.com"
                className="flex items-center gap-3 hover:text-brand-700"
              >
                <Mail className="h-4 w-4 shrink-0" />
                {t('footer.supportEmail')}
              </a>
              <a
                href="tel:+84948512463"
                className="mt-2 flex items-center gap-3 hover:text-brand-700"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {t('footer.supportPhone')}
              </a>
              <p className="mt-2 flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0" />
                {t('footer.headquarters')}
              </p>
            </address>
          </div>
          <div className="mt-10 flex flex-col gap-4 border-t border-gray-200 pt-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs">{t('footer.copyright')}</p>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
              <a href="#product">{t('footer.product')}</a>
              <Link to="/business/register">{t('nav.businessSignup')}</Link>
              <Link to="/login">{t('nav.login')}</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RevealSection({
  id,
  className,
  children,
}: Readonly<{ id?: string; className: string; children: ReactNode }>) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window)
  );

  useEffect(() => {
    if (visible || !sectionRef.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`${className} transform-gpu transition duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      {children}
    </section>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: Readonly<{ icon: typeof BellRing; title: string; description: string }>) {
  return (
    <article className="min-h-52 rounded-lg border border-gray-200 bg-gray-50 p-7 transition hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-md">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </article>
  );
}

function Solution({ icon: Icon, label }: Readonly<{ icon: typeof Store; label: string }>) {
  return (
    <div className="flex min-h-48 flex-col justify-between rounded-lg border border-white/10 bg-gray-900 p-6 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-gray-800">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-300/10">
        <Icon className="h-6 w-6 text-emerald-300" aria-hidden="true" />
      </span>
      <p className="mt-8 font-bold">{label}</p>
    </div>
  );
}
