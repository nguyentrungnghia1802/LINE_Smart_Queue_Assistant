import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { config } from '../../config';

function encryptionKey(): Buffer {
  const configured = config.email.tokenEncryptionKey.trim();
  if (config.nodeEnv === 'production' && configured.length < 32) {
    throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters in production');
  }
  return createHash('sha256')
    .update(configured || `${config.jwt.secret}:local-email-token`)
    .digest();
}

export function encryptEmailActionToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptEmailActionToken(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted email token');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
