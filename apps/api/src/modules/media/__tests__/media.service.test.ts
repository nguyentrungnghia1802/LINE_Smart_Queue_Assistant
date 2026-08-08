import sharp from 'sharp';

import { UserRole } from '@line-queue/shared';

import { MediaService } from '../media.service';
import { MockMediaStorage } from '../media-storage';

async function validPng() {
  const buffer = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#00b900' },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

describe('MediaService', () => {
  const asset = {
    id: '11111111-1111-4111-8111-111111111111',
    organization_id: '22222222-2222-4222-8222-222222222222',
    owner_user_id: '33333333-3333-4333-8333-333333333333',
    storage_provider: 'mock' as const,
    storage_key: 'organization_logo/test.webp',
    public_url: '/mock-media/organization_logo/test.webp',
    purpose: 'organization_logo' as const,
    content_type: 'image/webp',
    byte_size: 50,
    status: 'active' as const,
    deleted_at: null,
    created_at: new Date(),
  };

  function setup() {
    const storage = new MockMediaStorage();
    const repository = {
      create: jest.fn().mockImplementation((value) => ({ ...asset, ...value })),
      findById: jest.fn().mockResolvedValue(asset),
      markDeleted: jest.fn().mockResolvedValue(undefined),
    };
    return { storage, repository, service: new MediaService(storage, repository, 1024 * 1024) };
  }

  it('validates, compresses, and stores an image through the adapter', async () => {
    const { service, storage, repository } = setup();
    const result = await service.upload(
      { dataUrl: await validPng(), purpose: 'organization_logo' },
      { id: asset.owner_user_id, role: UserRole.ADMIN }
    );

    expect(storage.objects.size).toBe(1);
    expect([...storage.objects.values()][0]).toMatchObject({ contentType: 'image/webp' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ storage_provider: 'mock', content_type: 'image/webp' })
    );
    expect(result.public_url).toContain('/mock-media/');
  });

  it('rejects unsupported input before storage', async () => {
    const { service, storage } = setup();
    await expect(
      service.upload(
        { dataUrl: 'data:text/plain;base64,SGVsbG8=', purpose: 'product_image' },
        { id: asset.owner_user_id, role: UserRole.ADMIN }
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(storage.objects.size).toBe(0);
  });

  it('prevents a manager from targeting another tenant', async () => {
    const { service } = setup();
    await expect(
      service.upload(
        {
          dataUrl: await validPng(),
          purpose: 'product_image',
          organizationId: '44444444-4444-4444-8444-444444444444',
        },
        {
          id: asset.owner_user_id,
          role: UserRole.MANAGER,
          organizationId: asset.organization_id,
        }
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('deletes storage before marking the asset deleted', async () => {
    const { service, repository, storage } = setup();
    storage.objects.set(asset.storage_key, {
      key: asset.storage_key,
      body: Buffer.from('image'),
      contentType: asset.content_type,
    });

    await service.delete(asset.id, {
      id: asset.owner_user_id,
      role: UserRole.MANAGER,
      organizationId: asset.organization_id,
    });

    expect(storage.objects.has(asset.storage_key)).toBe(false);
    expect(repository.markDeleted).toHaveBeenCalledWith(asset.id);
  });

  it('retries a generated key collision without overwriting an existing object', async () => {
    const storage = {
      provider: 'mock' as const,
      put: jest
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('collision'), { code: 'EEXIST' }))
        .mockImplementation(async ({ key }: { key: string }) => ({
          key,
          publicUrl: `/mock-media/${key}`,
        })),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const repository = {
      create: jest.fn().mockImplementation((value) => ({ ...asset, ...value })),
      findById: jest.fn().mockResolvedValue(asset),
      markDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const generateKey = jest
      .fn()
      .mockReturnValueOnce('collision-key')
      .mockReturnValueOnce('fresh-key');
    const service = new MediaService(storage, repository, 1024 * 1024, generateKey);

    const result = await service.upload(
      { dataUrl: await validPng(), purpose: 'product_image' },
      { id: asset.owner_user_id, role: UserRole.ADMIN }
    );

    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(generateKey).toHaveBeenCalledTimes(2);
    expect(result.storage_key).toContain('fresh-key');
  });

  it('cleans the object when database registration fails', async () => {
    const { service, storage, repository } = setup();
    repository.create.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.upload(
        { dataUrl: await validPng(), purpose: 'organization_logo' },
        { id: asset.owner_user_id, role: UserRole.ADMIN }
      )
    ).rejects.toThrow('database unavailable');

    expect(storage.objects.size).toBe(0);
  });

  it('keeps metadata active when object deletion fails so the operation can be retried', async () => {
    const { service, repository, storage } = setup();
    jest.spyOn(storage, 'delete').mockRejectedValue(new Error('provider timeout'));

    await expect(
      service.delete(asset.id, {
        id: asset.owner_user_id,
        role: UserRole.MANAGER,
        organizationId: asset.organization_id,
      })
    ).rejects.toThrow('provider timeout');

    expect(repository.markDeleted).not.toHaveBeenCalled();
  });

  it('marks metadata deleted when the object is already missing', async () => {
    const { service, repository, storage } = setup();
    jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(Object.assign(new Error('missing'), { name: 'NotFound' }));

    await service.delete(asset.id, {
      id: asset.owner_user_id,
      role: UserRole.MANAGER,
      organizationId: asset.organization_id,
    });

    expect(repository.markDeleted).toHaveBeenCalledWith(asset.id);
  });

  it('treats repeated deletion of deleted metadata as idempotent', async () => {
    const { service, repository, storage } = setup();
    const deleteSpy = jest.spyOn(storage, 'delete');
    repository.findById.mockResolvedValue({ ...asset, status: 'deleted' });

    await service.delete(asset.id, {
      id: asset.owner_user_id,
      role: UserRole.MANAGER,
      organizationId: asset.organization_id,
    });

    expect(storage.objects.size).toBe(0);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(repository.markDeleted).not.toHaveBeenCalled();
  });
});
