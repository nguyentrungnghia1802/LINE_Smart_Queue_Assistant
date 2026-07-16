import '@testing-library/jest-dom';

import { beforeEach } from 'vitest';

import { i18n } from '../i18n';

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('ja');
});
