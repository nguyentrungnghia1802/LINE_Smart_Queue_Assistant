import { CreateQueueSchema } from '../queues.validator';

describe('CreateQueueSchema', () => {
  it('opens a newly created queue by default', () => {
    const result = CreateQueueSchema.parse({
      orgId: '11111111-1111-4111-8111-111111111111',
      name: 'General reception',
    });

    expect(result.status).toBe('open');
  });
});
