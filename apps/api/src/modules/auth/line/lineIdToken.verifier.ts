import { config } from '../../../config';
import { AppError } from '../../../utils/AppError';

// ── Shape returned by LINE's verify endpoint ──────────────────────────────────

/**
 * Verified identity data returned by LINE's OIDC verify endpoint.
 *
 * Only fields sourced from LINE's server-verified response are exposed here.
 * The raw id_token payload is intentionally not forwarded to callers.
 */
export interface LineVerifiedProfile {
  /** Stable LINE user identifier — matches `sub` in the LINE OIDC response. */
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  /** May be absent if the LIFF scope does not include `email`. */
  email?: string;
}

// ── Verifier ──────────────────────────────────────────────────────────────────

/**
 * Verify a LINE OIDC id_token by calling LINE's server-side verify endpoint.
 *
 * Security: We delegate verification to LINE's server (`/oauth2/v2.1/verify`)
 * rather than decoding the JWT locally. This ensures:
 *  - The token was issued by LINE for our channel (`client_id` check).
 *  - The token has not expired (LINE enforces this server-side).
 *  - The signature is valid.
 *
 * @throws {AppError} 401 if LINE rejects the token (expired, wrong channel, etc.)
 * @throws {AppError} 503 if the LINE verify call itself fails (network error).
 */
export async function verifyLineIdToken(idToken: string): Promise<LineVerifiedProfile> {
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: config.line.channelId,
  });

  let res: Response;
  try {
    res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    throw AppError.serviceUnavailable('Could not reach LINE verification service');
  }

  // LINE returns 400 with { error, error_description } when the token is invalid
  if (!res.ok) {
    throw AppError.unauthorized('LINE id_token verification failed');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (await res.json()) as Record<string, any>;

  return {
    lineUserId: String(payload['sub']),
    displayName: String(payload['name'] ?? ''),
    pictureUrl: payload['picture'] ? String(payload['picture']) : undefined,
    email: payload['email'] ? String(payload['email']) : undefined,
  };
}
