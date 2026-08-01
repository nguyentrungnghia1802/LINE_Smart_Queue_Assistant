import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  HeartPulse,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  QrCode,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Store,
  Utensils,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { BrandLogo } from '../../components/BrandLogo';
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { useAuthStore } from '../../store/authStore';

const PLAN_PRICES = { starter: 9_800, standard: 29_800, scale: 59_800 } as const;
const PLAN_CODES = Object.keys(PLAN_PRICES) as Array<keyof typeof PLAN_PRICES>;

export function MarketingHomePage() {
  const { t, i18n } = useTranslation(['marketing', 'common']);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ja', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }),
    [i18n.resolvedLanguage]
  );

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <MarketingHeader
        isAuthenticated={isAuthenticated}
        navigationOpen={navigationOpen}
        onToggleNavigation={() => setNavigationOpen((open) => !open)}
        onCloseNavigation={() => setNavigationOpen(false)}
      />

      <main>
        <HeroSection />

        <RevealSection
          id="product"
          className="scroll-mt-20 border-b border-gray-200 bg-white py-24 sm:py-28 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHeading
                eyebrow={t('product.eyebrow')}
                title={t('product.title')}
                description={t('product.description')}
              />
              <Link
                to="/business/register"
                className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-800"
              >
                {t('hero.primary')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="border-y border-gray-200">
              <Feature
                number="01"
                icon={MessageCircle}
                title={t('product.features.line.title')}
                description={t('product.features.line.description')}
              />
              <Feature
                number="02"
                icon={Clock3}
                title={t('product.features.queue.title')}
                description={t('product.features.queue.description')}
              />
              <Feature
                number="03"
                icon={BarChart3}
                title={t('product.features.analytics.title')}
                description={t('product.features.analytics.description')}
              />
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="solutions"
          className="scroll-mt-20 bg-gray-950 py-24 text-white sm:py-28 lg:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.65fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase text-emerald-300">
                  {t('solutions.eyebrow')}
                </p>
                <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
                  {t('solutions.title')}
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-gray-300 lg:justify-self-end">
                {t('solutions.description')}
              </p>
            </div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
              <Solution
                number="01"
                icon={Scissors}
                label={t('solutions.salon')}
                description={t('solutions.details.salon')}
              />
              <Solution
                number="02"
                icon={HeartPulse}
                label={t('solutions.clinic')}
                description={t('solutions.details.clinic')}
              />
              <Solution
                number="03"
                icon={Utensils}
                label={t('solutions.restaurant')}
                description={t('solutions.details.restaurant')}
              />
              <Solution
                number="04"
                icon={ShoppingBag}
                label={t('solutions.counter')}
                description={t('solutions.details.counter')}
              />
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="pricing"
          className="scroll-mt-20 border-b border-gray-200 bg-[#f5f7f6] py-24 sm:py-28 lg:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
              <SectionHeading eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} />
              <div className="border-l-2 border-brand-500 pl-5 text-sm leading-6 text-gray-600 lg:justify-self-end">
                {t('pricing.demoNotice')}
              </div>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {PLAN_CODES.map((plan, index) => (
                <PricingPlan
                  key={plan}
                  plan={plan}
                  number={String(index + 1).padStart(2, '0')}
                  price={currency.format(PLAN_PRICES[plan])}
                  recommended={plan === 'standard'}
                />
              ))}
            </div>
          </div>
        </RevealSection>

        <RevealSection className="bg-line-green py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-sm font-bold uppercase text-gray-950/65">Smart Queue Assistant</p>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-gray-950 sm:text-5xl">
                {t('cta.title')}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-900/75">
                {t('cta.description')}
              </p>
            </div>
            <Link
              to="/business/register"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-gray-950 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              {t('cta.action')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </RevealSection>
      </main>

      <MarketingFooter />
    </div>
  );
}

function MarketingHeader({
  isAuthenticated,
  navigationOpen,
  onToggleNavigation,
  onCloseNavigation,
}: Readonly<{
  isAuthenticated: boolean;
  navigationOpen: boolean;
  onToggleNavigation: () => void;
  onCloseNavigation: () => void;
}>) {
  const { t } = useTranslation(['marketing', 'common']);
  const accountPath = isAuthenticated ? '/dashboard' : '/login';
  const accountLabel = isAuthenticated ? t('nav.dashboard') : t('nav.login');

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3" onClick={onCloseNavigation}>
          <BrandLogo className="h-10 w-10" />
          <span className="hidden truncate text-sm font-bold sm:inline sm:text-base">
            Smart Queue Assistant
          </span>
        </Link>
        <nav
          className="ml-5 hidden items-center gap-7 lg:flex"
          aria-label={t('accessibility.mainNavigation', { ns: 'common' })}
        >
          <HeaderAnchor href="#product" label={t('nav.product')} />
          <HeaderAnchor href="#solutions" label={t('nav.solutions')} />
          <HeaderAnchor href="#pricing" label={t('nav.pricing')} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher compact />
          <Link
            to={accountPath}
            className="hidden min-h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-bold text-gray-800 hover:border-gray-950 md:inline-flex"
          >
            {accountLabel}
          </Link>
          <Link
            to="/business/register"
            className="hidden min-h-10 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white hover:bg-brand-700 sm:inline-flex"
          >
            <span>{t('nav.businessSignup')}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onToggleNavigation}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 lg:hidden"
            aria-label={t('nav.menu')}
            aria-expanded={navigationOpen}
          >
            {navigationOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {navigationOpen && (
        <nav
          className="border-t border-gray-200 bg-white px-4 py-4 lg:hidden"
          aria-label={t('accessibility.mainNavigation', { ns: 'common' })}
        >
          <div className="mx-auto grid max-w-7xl gap-1">
            <Link
              to="/business/register"
              onClick={onCloseNavigation}
              className="flex min-h-11 items-center justify-between rounded-lg bg-gray-950 px-3 text-sm font-bold text-white sm:hidden"
            >
              {t('nav.businessSignup')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {[
              ['#product', t('nav.product')],
              ['#solutions', t('nav.solutions')],
              ['#pricing', t('nav.pricing')],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={onCloseNavigation}
                className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {label}
                <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </a>
            ))}
            <Link
              to={accountPath}
              onClick={onCloseNavigation}
              className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-semibold text-gray-800 hover:bg-gray-100 md:hidden"
            >
              {accountLabel}
              <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function HeaderAnchor({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <a
      href={href}
      className="border-b-2 border-transparent py-6 text-sm font-semibold text-gray-600 transition hover:border-brand-500 hover:text-gray-950"
    >
      {label}
    </a>
  );
}

function HeroSection() {
  const { t } = useTranslation('marketing');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const signals = [
    { icon: QrCode, value: t('hero.signals.entry.value'), label: t('hero.signals.entry.label') },
    {
      icon: BellRing,
      value: t('hero.signals.notify.value'),
      label: t('hero.signals.notify.label'),
    },
    {
      icon: ShieldCheck,
      value: t('hero.signals.control.value'),
      label: t('hero.signals.control.label'),
    },
  ];

  useEffect(() => {
    if (!videoRef.current || typeof window.matchMedia !== 'function') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPlayback = () => {
      const video = videoRef.current;
      if (!video) return;
      if (reducedMotion.matches) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    };
    syncPlayback();
    reducedMotion.addEventListener('change', syncPlayback);
    return () => reducedMotion.removeEventListener('change', syncPlayback);
  }, []);

  return (
    <section className="relative isolate flex min-h-[calc(100svh-7rem)] items-end overflow-hidden bg-gray-950 text-white">
      <video
        ref={videoRef}
        data-testid="marketing-hero-video"
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/img/landing-hero.webp"
        aria-hidden="true"
      >
        <source src="/vid/banner.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gray-950/65" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-24 sm:px-6 sm:pb-12 lg:pt-32">
        <div className="max-w-4xl">
          <p className="flex items-center gap-3 text-sm font-bold uppercase text-emerald-300">
            <span className="h-px w-10 bg-emerald-300" aria-hidden="true" />
            {t('hero.eyebrow')}
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-gray-100 sm:text-lg">
            {t('hero.description')}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/business/register"
              className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-line-green px-6 py-3 text-sm font-bold text-white hover:bg-brand-600"
            >
              {t('hero.primary')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#product"
              className="inline-flex min-h-12 items-center rounded-lg border border-white/60 bg-gray-950/25 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/15"
            >
              {t('hero.secondary')}
            </a>
          </div>
        </div>

        <div className="mt-14 grid border-t border-white/30 sm:grid-cols-3">
          {signals.map((signal) => (
            <div
              key={signal.value}
              className="flex min-h-24 items-center gap-4 border-b border-white/20 py-5 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0"
            >
              <signal.icon className="h-6 w-6 shrink-0 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="font-bold text-white">{signal.value}</p>
                <p className="mt-1 text-xs leading-5 text-gray-300">{signal.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <a
        href="#product"
        className="absolute bottom-7 right-6 hidden h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/10 lg:flex"
        aria-label={t('hero.secondary')}
      >
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </a>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: Readonly<{ eyebrow: string; title: string; description?: string }>) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold uppercase text-brand-700">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-bold leading-tight text-gray-950 sm:text-5xl">{title}</h2>
      {description && <p className="mt-6 text-base leading-8 text-gray-600">{description}</p>}
    </div>
  );
}

function Feature({
  number,
  icon: Icon,
  title,
  description,
}: Readonly<{
  number: string;
  icon: typeof BellRing;
  title: string;
  description: string;
}>) {
  return (
    <article className="grid gap-5 border-b border-gray-200 py-9 last:border-b-0 sm:grid-cols-[48px_64px_1fr] sm:items-start sm:gap-6">
      <span className="text-xs font-bold text-gray-400">{number}</span>
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-xl font-bold text-gray-950">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600">{description}</p>
      </div>
    </article>
  );
}

function Solution({
  number,
  icon: Icon,
  label,
  description,
}: Readonly<{
  number: string;
  icon: typeof Store;
  label: string;
  description: string;
}>) {
  return (
    <article className="flex min-h-80 flex-col bg-gray-950 p-7 transition hover:bg-gray-900 sm:p-8">
      <div className="flex items-center justify-between text-gray-400">
        <span className="text-xs font-bold">{number}</span>
        <Icon className="h-8 w-8 text-emerald-300" aria-hidden="true" />
      </div>
      <div className="mt-auto pt-16">
        <h3 className="text-xl font-bold text-white">{label}</h3>
        <p className="mt-3 text-sm leading-6 text-gray-400">{description}</p>
      </div>
    </article>
  );
}

function PricingPlan({
  plan,
  number,
  price,
  recommended,
}: Readonly<{
  plan: keyof typeof PLAN_PRICES;
  number: string;
  price: string;
  recommended: boolean;
}>) {
  const { t } = useTranslation('marketing');
  return (
    <article
      className={`flex min-h-[520px] flex-col rounded-lg border p-7 transition hover:-translate-y-1 hover:shadow-xl sm:p-8 ${
        recommended
          ? 'border-gray-950 bg-gray-950 text-white'
          : 'border-gray-200 bg-white text-gray-950'
      }`}
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <span className={`text-xs font-bold ${recommended ? 'text-gray-400' : 'text-gray-400'}`}>
          {number}
        </span>
        {recommended && (
          <span className="rounded-md bg-line-green px-2.5 py-1 text-xs font-bold text-white">
            {t('pricing.standard.badge')}
          </span>
        )}
      </div>
      <h3 className="mt-8 text-2xl font-bold">{t(`pricing.${plan}.name`)}</h3>
      <p
        className={`mt-3 min-h-14 text-sm leading-6 ${recommended ? 'text-gray-300' : 'text-gray-600'}`}
      >
        {t(`pricing.${plan}.description`)}
      </p>
      <p className="mt-8 text-4xl font-bold">
        {price}
        <span
          className={`ml-1 text-sm font-medium ${recommended ? 'text-gray-400' : 'text-gray-500'}`}
        >
          {t('pricing.perMonth')}
        </span>
      </p>
      <ul
        className={`mt-8 space-y-4 border-t pt-7 ${recommended ? 'border-white/15' : 'border-gray-200'}`}
      >
        {(t(`pricing.${plan}.features`, { returnObjects: true }) as string[]).map((feature) => (
          <li key={feature} className="flex gap-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-line-green" aria-hidden="true" />
            <span className={recommended ? 'text-gray-200' : 'text-gray-700'}>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Link
          to={`/business/register?plan=${plan}`}
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold ${
            recommended
              ? 'bg-line-green text-white hover:bg-brand-600'
              : 'border border-gray-300 text-gray-950 hover:border-gray-950'
          }`}
        >
          {t('pricing.choose')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function MarketingFooter() {
  const { t } = useTranslation('marketing');
  return (
    <footer className="bg-white py-14 sm:py-18">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 border-b border-gray-200 pb-12 md:grid-cols-[1fr_auto] md:items-start">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-12 w-12" />
              <span className="text-lg font-bold">Smart Queue Assistant</span>
            </div>
            <p className="mt-5 text-sm leading-7 text-gray-600">{t('footer.description')}</p>
          </div>
          <address className="min-w-72 not-italic text-sm leading-6 text-gray-600">
            <p className="mb-4 text-base font-bold text-brand-700">{t('footer.contact')}</p>
            <a
              href="mailto:trungnghia180205@gmail.com"
              className="flex items-center gap-3 hover:text-brand-700"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('footer.supportEmail')}
            </a>
            <a
              href="tel:+84948512463"
              className="mt-3 flex items-center gap-3 hover:text-brand-700"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('footer.supportPhone')}
            </a>
            <p className="mt-3 flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('footer.headquarters')}
            </p>
          </address>
        </div>
        <div className="flex flex-col gap-5 pt-7 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs">{t('footer.copyright')}</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
            <a href="#product">{t('footer.product')}</a>
            <Link to="/business/register">{t('nav.businessSignup')}</Link>
            <Link to="/login">{t('nav.login')}</Link>
          </nav>
        </div>
      </div>
    </footer>
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
      { threshold: 0.12 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`${className} transform-gpu transition duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
      }`}
    >
      {children}
    </section>
  );
}
