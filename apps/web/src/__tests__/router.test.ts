import { describe, expect, it } from 'vitest';

import { appRoutes } from '../router';

describe('app routes', () => {
  it('lazy-loads each critical role surface instead of bundling every page at startup', () => {
    for (const path of ['/', '/manager', '/staff', '/liff', '/admin']) {
      const route = appRoutes.find((candidate) => candidate.path === path);

      expect(route, `missing route ${path}`).toBeDefined();
      expect(route?.element, `${path} should expose a lazy React element`).toBeDefined();
      expect(route).not.toHaveProperty('lazy');
    }
  });
});
