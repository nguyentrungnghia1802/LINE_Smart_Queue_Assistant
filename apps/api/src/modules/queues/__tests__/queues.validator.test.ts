import { CreateQueueSchema } from '../queues.validator';

describe('CreateQueueSchema', () => {
  it('opens a newly created queue by default', () => {
    const result = CreateQueueSchema.parse({
      orgId: '11111111-1111-4111-8111-111111111111',
      branchId: '22222222-2222-4222-8222-222222222222',
      name: 'General reception',
    });

    expect(result.status).toBe('open');
  });
});
