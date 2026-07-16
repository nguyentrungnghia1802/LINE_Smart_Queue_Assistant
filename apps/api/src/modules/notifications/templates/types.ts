import type { SupportedLocale } from '@line-queue/shared';

export type TicketNotificationEventType =
  | 'booking_created'
  | 'eta_warning'
  | 'called'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'location_warning';

export interface LineNotificationCopy {
  locale: SupportedLocale;
  systemName: string;
  labels: {
    ticket: string;
    status: string;
    ahead: string;
    eta: string;
    openTicket: string;
    ticketLink: string;
  };
  values: {
    checking: string;
    none: string;
    soon: string;
    people: (count: number) => string;
    minutes: (count: number) => string;
    hours: (hours: number, minutes: number) => string;
  };
  events: Record<
    TicketNotificationEventType,
    { headline: string; status: string; guidance: string; accentColor: string }
  >;
  statuses: Record<string, string>;
  commands: {
    welcome: string;
    help: string;
    noActive: string;
    activeHeader: string;
    noCancellable: string;
    cancelSucceeded: string;
    cancelFailed: string;
    skipSucceeded: (ticketCode: string) => string;
    skipFailed: string;
    unknown: string;
  };
}
