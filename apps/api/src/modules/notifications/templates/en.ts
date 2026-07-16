import type { LineNotificationCopy } from './types';

export const enLineNotificationCopy: LineNotificationCopy = {
  locale: 'en',
  systemName: 'LINE Smart Queue Assistant',
  labels: {
    ticket: 'Ticket',
    status: 'Status',
    ahead: 'People ahead',
    eta: 'Estimated wait',
    openTicket: 'Open ticket',
    ticketLink: 'Ticket details',
  },
  values: {
    checking: 'Checking',
    none: 'None',
    soon: 'Soon',
    people: (count) => `${count} people`,
    minutes: (count) => `About ${count} min`,
    hours: (hours, minutes) =>
      minutes === 0 ? `About ${hours} hr` : `About ${hours} hr ${minutes} min`,
  },
  events: {
    booking_created: {
      headline: 'Booking confirmed',
      status: 'Confirmed',
      guidance: 'Please monitor your ticket while you wait for your turn.',
      accentColor: '#06C755',
    },
    eta_warning: {
      headline: 'Your turn is approaching',
      status: 'Approaching',
      guidance: 'Please return and wait near the counter.',
      accentColor: '#F59E0B',
    },
    called: {
      headline: 'It is your turn',
      status: 'Called',
      guidance: 'Please come to the counter.',
      accentColor: '#06C755',
    },
    serving: {
      headline: 'Service has started',
      status: 'Serving',
      guidance: 'Please follow the staff instructions.',
      accentColor: '#2563EB',
    },
    completed: {
      headline: 'Service completed',
      status: 'Completed',
      guidance: 'Thank you for using our service.',
      accentColor: '#4B5563',
    },
    cancelled: {
      headline: 'Ticket cancelled',
      status: 'Cancelled',
      guidance: 'Please make a new booking if you still need service.',
      accentColor: '#DC2626',
    },
    no_show: {
      headline: 'Marked as no-show',
      status: 'No-show',
      guidance: 'Please speak with staff if you still need assistance.',
      accentColor: '#EA580C',
    },
    location_warning: {
      headline: 'Check your distance from the store',
      status: 'Return reminder',
      guidance: 'Your turn is approaching. Please allow enough time to return.',
      accentColor: '#0F766E',
    },
  },
  statuses: {
    waiting: 'Waiting',
    called: 'Called',
    serving: 'Serving',
    served: 'Completed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    skipped: 'Moved back',
    no_show: 'No-show',
  },
  commands: {
    welcome:
      'Welcome to LINE Smart Queue Assistant.\n\nScan the store QR code to receive a ticket.\nSend "STATUS" for your current ticket or "HELP" for instructions.',
    help: 'Available commands:\nSTATUS - View your current ticket\nCANCEL - Cancel your current ticket\nHELP - Show this guide',
    noActive: 'You have no active ticket.\nScan the store QR code to join the queue.',
    activeHeader: 'Current tickets:',
    noCancellable: 'There is no active ticket that can be cancelled.',
    cancelSucceeded: 'Your ticket was cancelled.',
    cancelFailed: 'The ticket could not be cancelled. It may already be processed.',
    skipSucceeded: (ticketCode) => `Ticket ${ticketCode} was moved back one position.`,
    skipFailed: 'The ticket could not be moved back. Please try again.',
    unknown: 'Send "HELP" to view usage instructions.',
  },
};
