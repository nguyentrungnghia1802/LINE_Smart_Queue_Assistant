/**
 * Unit tests for queue entry Zod validators.
 * No HTTP layer — tests parse schemas directly.
 */

import {
  CurrentQueueQuerySchema,
  EntryIdParamSchema,
  JoinQueueSchema,
  QueueIdParamSchema,
} from '../queue.validator';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const INVALID_UUID = 'not-a-uuid';

// ── JoinQueueSchema ───────────────────────────────────────────────────────────

describe('JoinQueueSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = JoinQueueSchema.safeParse({ queueId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const result = JoinQueueSchema.safeParse({
      queueId: VALID_UUID,
      lineUserId: 'Udeadbeef1234567890abcdef012345678',
      notes: 'Window seat please',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing queueId', () => {
    const result = JoinQueueSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('queueId');
    }
  });

  it('rejects invalid queueId (not a UUID)', () => {
    const result = JoinQueueSchema.safeParse({ queueId: INVALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('queueId');
    }
  });

  it('rejects notes exceeding 500 characters', () => {
    const result = JoinQueueSchema.safeParse({
      queueId: VALID_UUID,
      notes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('notes');
    }
  });

  it('accepts notes at exactly 500 characters (boundary)', () => {
    const result = JoinQueueSchema.safeParse({
      queueId: VALID_UUID,
      notes: 'x'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty lineUserId (min 1)', () => {
    const result = JoinQueueSchema.safeParse({ queueId: VALID_UUID, lineUserId: '' });
    expect(result.success).toBe(false);
  });
});

// ── CurrentQueueQuerySchema ───────────────────────────────────────────────────

describe('CurrentQueueQuerySchema', () => {
  it('accepts a valid UUID', () => {
    const result = CurrentQueueQuerySchema.safeParse({ queueId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing queueId', () => {
    const result = CurrentQueueQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID format', () => {
    const result = CurrentQueueQuerySchema.safeParse({ queueId: INVALID_UUID });
    expect(result.success).toBe(false);
  });
});

// ── EntryIdParamSchema ────────────────────────────────────────────────────────

describe('EntryIdParamSchema', () => {
  it('accepts a valid entryId', () => {
    const result = EntryIdParamSchema.safeParse({ entryId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing entryId', () => {
    const result = EntryIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID entryId', () => {
    const result = EntryIdParamSchema.safeParse({ entryId: '12345' });
    expect(result.success).toBe(false);
  });
});

// ── QueueIdParamSchema ────────────────────────────────────────────────────────

describe('QueueIdParamSchema', () => {
  it('accepts a valid queueId', () => {
    const result = QueueIdParamSchema.safeParse({ queueId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing queueId', () => {
    const result = QueueIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID queueId', () => {
    const result = QueueIdParamSchema.safeParse({ queueId: 'bad' });
    expect(result.success).toBe(false);
  });
});
