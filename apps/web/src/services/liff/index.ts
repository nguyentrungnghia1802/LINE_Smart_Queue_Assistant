/**
 * LIFF adapter factory.
 *
 * Selects the correct adapter at build time based on VITE_LIFF_MOCK:
 *   • VITE_LIFF_MOCK=true  → MockLiffAdapter (no real LINE SDK calls)
 *   • otherwise            → RealLiffAdapter (requires VITE_LIFF_ID)
 *
 * The singleton is created once and shared across the app via useLiff().
 */

export type { LiffAdapter, LiffProfile } from './types';

import { MockLiffAdapter } from './mock.adapter';
import { RealLiffAdapter } from './real.adapter';
import type { LiffAdapter } from './types';

const isMock = import.meta.env.VITE_LIFF_MOCK === 'true';

/**
 * Singleton adapter instance.
 * Import this in useLiff — never import @line/liff directly outside real.adapter.ts.
 */
export const liffAdapter: LiffAdapter = isMock ? new MockLiffAdapter() : new RealLiffAdapter();

export { isMock as isLiffMockMode };
