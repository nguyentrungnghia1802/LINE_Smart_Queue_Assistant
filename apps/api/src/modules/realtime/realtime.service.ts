import type { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { config } from '../../config';
import {
  queueEntriesRepository,
  type QueueEntryRow,
} from '../../db/repositories/queue-entries.repository';
import { type QueueRow, queuesRepository } from '../../db/repositories/queues.repository';
import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { metricsService } from '../../utils/metrics';
import { requireBranchOperator } from '../branches/branch-scope';

import {
  createRealtimeEvent,
  type RealtimeEvent,
  type RealtimeEventName,
  type RealtimeEventScope,
} from './realtime.contract';
import { type RealtimeHub, realtimeHub } from './realtime.hub';

interface RealtimeServiceOptions {
  keepAliveMs: number;
  retryMs: number;
  maxConnectionDurationMs: number;
}

interface TicketRepositoryPort {
  findById(id: string): Promise<QueueEntryRow | null>;
}

interface QueueRepositoryPort {
  findById(id: string): Promise<QueueRow | null>;
}

const MAX_BUFFERED_BYTES = 64 * 1024;

export function formatSseEvent(event: RealtimeEvent): string {
  return `id: ${event.id}\nevent: ${event.name}\ndata: ${JSON.stringify(event)}\n\n`;
}

export class RealtimeService {
  private readonly activeClosers = new Set<() => void>();

  constructor(
    private readonly hub: RealtimeHub,
    private readonly ticketRepository: TicketRepositoryPort,
    private readonly queueRepository: QueueRepositoryPort,
    private readonly options: RealtimeServiceOptions
  ) {}

  async start(): Promise<void> {
    await this.hub.start();
  }

  async stop(): Promise<void> {
    for (const close of [...this.activeClosers]) close();
    this.activeClosers.clear();
    await this.hub.stop();
  }

  async openTicketStream(
    req: Request,
    res: Response,
    actor: AuthUser,
    entryId: string
  ): Promise<void> {
    const scope = await this.authorizeTicket(actor, entryId);
    await this.openStream(
      req,
      res,
      actor.id,
      this.hub.queueChannel(scope),
      (event) => event.name === 'queue.summary_updated' || event.scope.ticketId === entryId
    );
  }

  async openQueueStream(
    req: Request,
    res: Response,
    actor: AuthUser,
    queueId: string
  ): Promise<void> {
    const scope = await this.authorizeQueue(actor, queueId);
    await this.openStream(req, res, actor.id, this.hub.queueChannel(scope));
  }

  async authorizeTicket(actor: AuthUser, entryId: string): Promise<RealtimeEventScope> {
    if (actor.role !== UserRole.CUSTOMER) {
      throw AppError.forbidden('Customer account is required for a ticket stream');
    }
    const entry = await this.ticketRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');
    const ownsByUser = entry.user_id === actor.id;
    const ownsByLine = Boolean(actor.lineUserId && entry.line_user_id === actor.lineUserId);
    if (!ownsByUser && !ownsByLine) throw AppError.forbidden('You do not own this ticket');

    const queue = await this.queueRepository.findById(entry.queue_id);
    if (!queue) throw AppError.notFound('Queue');
    if (!queue.branch_id) throw AppError.forbidden('Ticket queue has no active branch scope');
    return {
      organizationId: queue.organization_id,
      branchId: queue.branch_id,
      queueId: queue.id,
      ticketId: entry.id,
    };
  }

  async authorizeQueue(actor: AuthUser, queueId: string): Promise<RealtimeEventScope> {
    const operator = requireBranchOperator(actor);
    const queue = await this.queueRepository.findById(queueId);
    if (!queue) throw AppError.notFound('Queue');
    if (
      queue.organization_id !== operator.organizationId ||
      queue.branch_id !== operator.branchId
    ) {
      throw AppError.forbidden('Queue is outside your assigned branch');
    }
    if (actor.role === UserRole.STAFF && actor.assignedQueueId !== queue.id) {
      throw AppError.forbidden('Queue is outside your staff assignment');
    }
    return {
      organizationId: queue.organization_id,
      branchId: queue.branch_id,
      queueId: queue.id,
    };
  }

  async publishTicketEvent(input: {
    name: Exclude<RealtimeEventName, 'queue.summary_updated'>;
    entry: Pick<QueueEntryRow, 'id' | 'status' | 'estimated_wait_seconds'>;
    queue: Pick<QueueRow, 'id' | 'organization_id' | 'branch_id'>;
    aheadCount?: number;
  }): Promise<void> {
    if (!input.queue.branch_id) return;
    await this.hub.publish(
      createRealtimeEvent({
        name: input.name,
        scope: {
          organizationId: input.queue.organization_id,
          branchId: input.queue.branch_id,
          queueId: input.queue.id,
          ticketId: input.entry.id,
        },
        payload: {
          status: input.entry.status,
          ...(input.aheadCount !== undefined && { aheadCount: input.aheadCount }),
          ...(input.entry.estimated_wait_seconds !== undefined && {
            estimatedWaitSeconds: input.entry.estimated_wait_seconds,
          }),
        },
      })
    );
  }

  async publishQueueSummary(input: {
    queue: Pick<QueueRow, 'id' | 'organization_id' | 'branch_id'>;
    reason: string;
  }): Promise<void> {
    if (!input.queue.branch_id) return;
    await this.hub.publish(
      createRealtimeEvent({
        name: 'queue.summary_updated',
        scope: {
          organizationId: input.queue.organization_id,
          branchId: input.queue.branch_id,
          queueId: input.queue.id,
        },
        payload: { reason: input.reason },
      })
    );
  }

  private async openStream(
    req: Request,
    res: Response,
    userId: string,
    channel: string,
    accepts: (event: RealtimeEvent) => boolean = () => true
  ): Promise<void> {
    let cleanup = async (): Promise<void> => undefined;
    const release = await this.hub.subscribe({
      userId,
      channel,
      accepts,
      onEvent: (event) => {
        if (res.destroyed || res.writableEnded || res.writableLength > MAX_BUFFERED_BYTES) {
          metricsService.increment('sse_send_failures_total');
          void cleanup();
          return;
        }
        res.write(formatSseEvent(event));
      },
    });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`retry: ${this.options.retryMs}\n\n: connected\n\n`);
    if (req.get('last-event-id')) metricsService.increment('sse_reconnects_total');

    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(keepAlive);
      clearTimeout(maxDuration);
      this.activeClosers.delete(close);
      void release();
      if (!res.writableEnded) res.end();
    };
    cleanup = async () => close();
    this.activeClosers.add(close);

    const keepAlive = setInterval(() => {
      if (res.destroyed || res.writableEnded) return close();
      res.write(`: keep-alive ${Date.now()}\n\n`);
    }, this.options.keepAliveMs);
    keepAlive.unref?.();
    const maxDuration = setTimeout(() => {
      if (!res.writableEnded) {
        res.write('event: stream.closed\ndata: {"reason":"reauthenticate"}\n\n');
      }
      close();
    }, this.options.maxConnectionDurationMs);
    maxDuration.unref?.();

    req.once('close', close);
    res.once('close', close);
    res.once('error', close);
  }
}

export const realtimeService = new RealtimeService(
  realtimeHub,
  queueEntriesRepository,
  queuesRepository,
  config.realtime
);
