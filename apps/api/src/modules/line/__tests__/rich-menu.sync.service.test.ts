import { logger } from '../../../utils/logger';
import { MockLineRichMenuAdapter } from '../rich-menu.adapter';
import { buildSmartQueueRichMenuDefinition } from '../rich-menu.definition';
import { syncRichMenu } from '../rich-menu.sync.service';

function makeImage() {
  return {
    buffer: Buffer.from('png'),
    contentType: 'image/png' as const,
    source: 'test.png',
  };
}

describe('rich-menu.sync.service', () => {
  it('creates, uploads, and sets a default Rich Menu', async () => {
    const adapter = new MockLineRichMenuAdapter();
    const definition = buildSmartQueueRichMenuDefinition({ liffId: 'liff-123' });

    const result = await syncRichMenu({
      adapter,
      definition,
      image: makeImage(),
    });

    expect(result.created).toBe(true);
    expect(adapter.calls.map((call) => call.type)).toEqual([
      'list',
      'create',
      'upload',
      'setDefault',
    ]);
    expect(adapter.defaultRichMenuId).toBe(result.richMenuId);
  });

  it('is idempotent and reuses an existing menu with the same name', async () => {
    const definition = buildSmartQueueRichMenuDefinition({ liffId: 'liff-123' });
    const adapter = new MockLineRichMenuAdapter([
      { richMenuId: 'existing-1', name: definition.name },
    ]);

    const result = await syncRichMenu({
      adapter,
      definition,
      image: makeImage(),
    });

    expect(result).toMatchObject({
      richMenuId: 'existing-1',
      created: false,
      replaced: false,
    });
    expect(adapter.calls.map((call) => call.type)).toEqual(['list', 'upload', 'setDefault']);
  });

  it('deletes duplicate menus without creating uncontrolled copies', async () => {
    const definition = buildSmartQueueRichMenuDefinition({ liffId: 'liff-123' });
    const adapter = new MockLineRichMenuAdapter([
      { richMenuId: 'existing-1', name: definition.name },
      { richMenuId: 'duplicate-1', name: definition.name },
    ]);

    const result = await syncRichMenu({
      adapter,
      definition,
      image: makeImage(),
    });

    expect(result.deletedRichMenuIds).toEqual(['duplicate-1']);
    expect(adapter.richMenus.has('duplicate-1')).toBe(false);
    expect(adapter.calls.map((call) => call.type)).toEqual([
      'list',
      'delete',
      'upload',
      'setDefault',
    ]);
  });

  it('supports explicit replacement of old menu definitions', async () => {
    const definition = buildSmartQueueRichMenuDefinition({ liffId: 'liff-123' });
    const adapter = new MockLineRichMenuAdapter([{ richMenuId: 'old-1', name: definition.name }]);

    const result = await syncRichMenu({
      adapter,
      definition,
      image: makeImage(),
      replace: true,
    });

    expect(result.replaced).toBe(true);
    expect(result.deletedRichMenuIds).toEqual(['old-1']);
    expect(result.richMenuId).not.toBe('old-1');
  });

  it('uses the mock adapter without calling LINE HTTP APIs', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const adapter = new MockLineRichMenuAdapter();

    await syncRichMenu({
      adapter,
      definition: buildSmartQueueRichMenuDefinition({ liffId: 'liff-123' }),
      image: makeImage(),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('logs and reports LINE API failures clearly', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation();
    const adapter = new MockLineRichMenuAdapter();
    jest.spyOn(adapter, 'createRichMenu').mockRejectedValueOnce(new Error('LINE failed'));

    await expect(
      syncRichMenu({
        adapter,
        definition: buildSmartQueueRichMenuDefinition({ liffId: 'liff-123' }),
        image: makeImage(),
      })
    ).rejects.toThrow('LINE Rich Menu sync failed');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ richMenuName: 'line-smart-queue-main-v1' }),
      'LINE Rich Menu sync failed'
    );
    errorSpy.mockRestore();
  });
});
