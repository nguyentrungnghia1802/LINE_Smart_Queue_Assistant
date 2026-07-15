import { API_BASE_PATH } from '@line-queue/shared';

import { post } from './apiClient';

export interface MediaAsset {
  id: string;
  public_url: string;
  content_type: string;
  byte_size: number;
}

export function uploadImage(
  dataUrl: string,
  purpose: 'organization_logo' | 'product_image',
  organizationId?: string | null
) {
  return post<MediaAsset>(`${API_BASE_PATH}/media`, { dataUrl, purpose, organizationId });
}
