import { logger } from '../../utils/logger';

import type { RichMenuDefinition, RichMenuSummary } from './rich-menu.types';

const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2/bot';

export interface ILineRichMenuAdapter {
  createRichMenu(definition: RichMenuDefinition): Promise<string>;
  uploadRichMenuImage(
    richMenuId: string,
    image: Buffer,
    contentType: 'image/png' | 'image/jpeg'
  ): Promise<void>;
  setDefaultRichMenu(richMenuId: string): Promise<void>;
  listRichMenus(): Promise<RichMenuSummary[]>;
  deleteRichMenu(richMenuId: string): Promise<void>;
}

export class LineRichMenuSdkAdapter implements ILineRichMenuAdapter {
  private readonly authHeader: string;

  constructor(channelAccessToken: string) {
    this.authHeader = `Bearer ${channelAccessToken}`;
  }

  async createRichMenu(definition: RichMenuDefinition): Promise<string> {
    const payload = await this.request<{ richMenuId: string }>('/richmenu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition),
    });
    return payload.richMenuId;
  }

  async uploadRichMenuImage(
    richMenuId: string,
    image: Buffer,
    contentType: 'image/png' | 'image/jpeg'
  ): Promise<void> {
    await this.request<void>(
      `/richmenu/${richMenuId}/content`,
      {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: image,
      },
      LINE_DATA_API_BASE
    );
  }

  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    await this.request<void>(`/user/all/richmenu/${richMenuId}`, { method: 'POST' });
  }

  async listRichMenus(): Promise<RichMenuSummary[]> {
    const payload = await this.request<{ richmenus: RichMenuSummary[] }>('/richmenu/list', {
      method: 'GET',
    });
    return payload.richmenus;
  }

  async deleteRichMenu(richMenuId: string): Promise<void> {
    await this.request<void>(`/richmenu/${richMenuId}`, { method: 'DELETE' });
  }

  private async request<T>(
    pathName: string,
    init: RequestInit,
    baseUrl = LINE_API_BASE
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', this.authHeader);

    const res = await fetch(`${baseUrl}${pathName}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '(unreadable)');
      logger.error(
        { statusCode: res.status, path: pathName, detail },
        'LINE Rich Menu API request failed'
      );
      throw new Error(`LINE Rich Menu API returned ${res.status} for ${pathName}`);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

export interface MockRichMenuCall {
  type: 'create' | 'upload' | 'setDefault' | 'list' | 'delete';
  richMenuId?: string;
  name?: string;
  contentType?: string;
}

export class MockLineRichMenuAdapter implements ILineRichMenuAdapter {
  readonly calls: MockRichMenuCall[] = [];
  readonly richMenus = new Map<string, RichMenuSummary>();
  defaultRichMenuId: string | null = null;
  private nextId = 1;

  constructor(initialMenus: RichMenuSummary[] = []) {
    for (const menu of initialMenus) {
      this.richMenus.set(menu.richMenuId, menu);
    }
  }

  async createRichMenu(definition: RichMenuDefinition): Promise<string> {
    const id = `mock-rich-menu-${this.nextId++}`;
    this.richMenus.set(id, {
      richMenuId: id,
      name: definition.name,
      chatBarText: definition.chatBarText,
    });
    this.calls.push({ type: 'create', richMenuId: id, name: definition.name });
    return id;
  }

  async uploadRichMenuImage(
    richMenuId: string,
    _image: Buffer,
    contentType: 'image/png' | 'image/jpeg'
  ): Promise<void> {
    this.calls.push({ type: 'upload', richMenuId, contentType });
  }

  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    this.defaultRichMenuId = richMenuId;
    this.calls.push({ type: 'setDefault', richMenuId });
  }

  async listRichMenus(): Promise<RichMenuSummary[]> {
    this.calls.push({ type: 'list' });
    return [...this.richMenus.values()];
  }

  async deleteRichMenu(richMenuId: string): Promise<void> {
    this.richMenus.delete(richMenuId);
    this.calls.push({ type: 'delete', richMenuId });
  }
}
