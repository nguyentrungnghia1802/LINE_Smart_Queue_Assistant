import express from 'express';
import request from 'supertest';

import { UserRole } from '@line-queue/shared';

import { authRouter } from '../auth.routes';
import { authService } from '../auth.service';

const session = {
  id: 'session-row-id',
  familyId: 'session-family-id',
  userId: 'user-1',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
  kind: 'business' as const,
  idleTimeoutMs: 15 * 60_000,
};
const user = {
  id: 'user-1',
  role: UserRole.STAFF,
  displayName: 'Staff',
};

function testApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  return app;
}

describe('auth session routes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets an HttpOnly same-site refresh cookie after business login', async () => {
    jest.spyOn(authService, 'loginWithEmailPassword').mockResolvedValue({
      token: 'access-token',
      user,
      session,
    });

    const response = await request(testApp())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.com', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      token: 'access-token',
      session: { kind: 'business', idleTimeoutSeconds: 900 },
    });
    expect(response.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('lq_refresh_session=refresh-token')
    );
    expect(response.headers['set-cookie']?.[0]).toEqual(expect.stringContaining('HttpOnly'));
    expect(response.headers['set-cookie']?.[0]).toEqual(expect.stringContaining('SameSite=Strict'));
    expect(response.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('Path=/api/v1/auth')
    );
  });

  it('rotates the cookie through the refresh endpoint', async () => {
    jest.spyOn(authService, 'refreshSession').mockResolvedValue({
      token: 'new-access-token',
      user,
      session: { ...session, refreshToken: 'new-refresh-token' },
    });

    const response = await request(testApp())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'lq_refresh_session=old-refresh-token');

    expect(response.status).toBe(200);
    expect(authService.refreshSession).toHaveBeenCalledWith('old-refresh-token');
    expect(response.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('lq_refresh_session=new-refresh-token')
    );
  });

  it('revokes the server session and clears the cookie on logout', async () => {
    jest.spyOn(authService, 'logout').mockResolvedValue();

    const response = await request(testApp())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'lq_refresh_session=refresh-token');

    expect(response.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('lq_refresh_session=')
    );
    expect(response.headers['set-cookie']?.[0]).toEqual(expect.stringContaining('Expires='));
  });
});
