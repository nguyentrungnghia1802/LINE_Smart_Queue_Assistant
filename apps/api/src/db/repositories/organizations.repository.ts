import { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  line_channel_id: string | null;
  line_oa_basic_id: string | null;
  timezone: string;
  default_locale: SupportedLocale;
  settings: Record<string, unknown>;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  latitude?: string | null;
  longitude?: string | null;
  payment_info: string | null;
  public_qr_token: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OrgMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  joined_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateOrganizationParams {
  name: string;
  slug: string;
  publicQrToken: string;
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  paymentInfo?: string | null;
  timezone?: string;
  defaultLocale?: SupportedLocale;
  lineChannelId?: string;
  lineOaBasicId?: string;
  settings?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class OrganizationsRepository extends BaseRepository {
  async listActive(): Promise<OrganizationRow[]> {
    return this.query<OrganizationRow>(
      `SELECT *
       FROM organizations
       WHERE is_active = TRUE
       ORDER BY created_at DESC`
    );
  }

  async findById(id: string): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE id = $1 AND is_active = TRUE',
      [id]
    );
  }

  async findBySlug(slug: string): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE slug = $1 AND is_active = TRUE',
      [slug]
    );
  }

  async findByPublicToken(token: string): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE public_qr_token = $1 AND is_active = TRUE',
      [token]
    );
  }

  async findLocalizedById(id: string, locale: SupportedLocale): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      `SELECT o.*,
              COALESCE(requested.name, tenant_default.name, japanese.name, o.name) AS name
       FROM organizations o
       LEFT JOIN organization_translations requested ON requested.organization_id = o.id AND requested.locale = $2
       LEFT JOIN organization_translations tenant_default ON tenant_default.organization_id = o.id AND tenant_default.locale = o.default_locale
       LEFT JOIN organization_translations japanese ON japanese.organization_id = o.id AND japanese.locale = 'ja'
       WHERE o.id = $1 AND o.is_active = TRUE`,
      [id, locale]
    );
  }

  async create(params: CreateOrganizationParams, client?: PoolClient): Promise<OrganizationRow> {
    const sql = `
      INSERT INTO organizations
        (
          name, slug, public_qr_token, logo_url, phone, address, payment_info,
          timezone, default_locale, line_channel_id, line_oa_basic_id, settings, postal_code,
          prefecture, city, address_line1, address_line2
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    const args = [
      params.name,
      params.slug,
      params.publicQrToken,
      params.logoUrl ?? null,
      params.phone ?? null,
      params.address ?? null,
      params.paymentInfo ?? null,
      params.timezone ?? 'Asia/Tokyo',
      params.defaultLocale ?? 'ja',
      params.lineChannelId ?? null,
      params.lineOaBasicId ?? null,
      JSON.stringify(params.settings ?? {}),
      params.postalCode ?? null,
      params.prefecture ?? null,
      params.city ?? null,
      params.addressLine1 ?? null,
      params.addressLine2 ?? null,
    ];
    const rows = client
      ? await this.queryTx<OrganizationRow>(client, sql, args)
      : await this.query<OrganizationRow>(sql, args);
    const organization = this.firstOrThrow(rows, 'organizations.create');
    const translationSql = `
      INSERT INTO organization_translations (organization_id, locale, name)
      VALUES ($1,$2,$3)
      ON CONFLICT (organization_id, locale) DO UPDATE SET name = EXCLUDED.name
    `;
    const translationArgs = [organization.id, organization.default_locale, organization.name];
    if (client) await this.queryTx(client, translationSql, translationArgs);
    else await this.query(translationSql, translationArgs);
    return organization;
  }

  // ── Members ─────────────────────────────────────────────────────────────────

  /**
   * Check whether userId has a given role (or any role) in organizationId.
   * Used by auth middleware on every staff/manager request.
   */
  async findMember(organizationId: string, userId: string): Promise<OrgMemberRow | null> {
    return this.queryOne<OrgMemberRow>(
      `SELECT * FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );
  }

  async addMember(
    organizationId: string,
    userId: string,
    role: 'manager' | 'staff' = 'staff',
    client?: PoolClient
  ): Promise<OrgMemberRow> {
    const sql = `
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `;
    const args = [organizationId, userId, role];
    const rows = client
      ? await this.queryTx<OrgMemberRow>(client, sql, args)
      : await this.query<OrgMemberRow>(sql, args);
    return this.firstOrThrow(rows, 'organizations.addMember');
  }

  async listMembers(organizationId: string): Promise<OrgMemberRow[]> {
    return this.query<OrgMemberRow>(
      `SELECT * FROM organization_members WHERE organization_id = $1 AND is_active = TRUE ORDER BY joined_at`,
      [organizationId]
    );
  }

  async findMembershipByUserId(userId: string): Promise<OrgMemberRow | null> {
    return this.queryOne<OrgMemberRow>(
      `SELECT * FROM organization_members WHERE user_id = $1 AND is_active = TRUE ORDER BY joined_at LIMIT 1`,
      [userId]
    );
  }

  async setMemberActive(organizationId: string, userId: string, isActive: boolean): Promise<void> {
    await this.query(
      `UPDATE organization_members SET is_active = $1 WHERE organization_id = $2 AND user_id = $3`,
      [isActive, organizationId, userId]
    );
  }

  async updateOrg(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      publicQrToken: string | null;
      logoUrl: string | null;
      phone: string | null;
      address: string | null;
      postalCode: string | null;
      prefecture: string | null;
      city: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      defaultLocale: SupportedLocale;
      latitude: number | null;
      longitude: number | null;
      paymentInfo: string | null;
      settings: Record<string, unknown>;
    }>
  ): Promise<OrganizationRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const map: Record<string, string> = {
      name: 'name',
      slug: 'slug',
      publicQrToken: 'public_qr_token',
      logoUrl: 'logo_url',
      phone: 'phone',
      address: 'address',
      postalCode: 'postal_code',
      prefecture: 'prefecture',
      city: 'city',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      defaultLocale: 'default_locale',
      latitude: 'latitude',
      longitude: 'longitude',
      paymentInfo: 'payment_info',
      settings: 'settings',
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`);
        const value = (data as Record<string, unknown>)[key];
        values.push(key === 'settings' ? JSON.stringify(value ?? {}) : value);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const rows = await this.query<OrganizationRow>(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    const organization = rows[0] ?? null;
    if (organization && data.name !== undefined) {
      await this.query(
        `INSERT INTO organization_translations (organization_id, locale, name)
         VALUES ($1,$2,$3)
         ON CONFLICT (organization_id, locale) DO UPDATE SET name = EXCLUDED.name`,
        [organization.id, organization.default_locale, organization.name]
      );
    }
    return organization;
  }

  async deactivate(id: string): Promise<void> {
    await this.query(
      'UPDATE organizations SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async getBusinessCalendar(organizationId: string) {
    const [weeklyHours, exceptionDays] = await Promise.all([
      this.query<{
        weekday: number;
        is_closed: boolean;
        opens_at: string | null;
        closes_at: string | null;
      }>(
        `SELECT weekday, is_closed, opens_at::text, closes_at::text
         FROM organization_business_hours WHERE organization_id = $1 ORDER BY weekday`,
        [organizationId]
      ),
      this.query<{
        exception_date: string;
        is_closed: boolean;
        opens_at: string | null;
        closes_at: string | null;
        reason: string | null;
      }>(
        `SELECT exception_date::text, is_closed, opens_at::text, closes_at::text, reason
         FROM organization_exception_days
         WHERE organization_id = $1 AND exception_date >= CURRENT_DATE
         ORDER BY exception_date LIMIT 100`,
        [organizationId]
      ),
    ]);
    return { weeklyHours, exceptionDays };
  }

  async replaceBusinessCalendar(
    organizationId: string,
    calendar: {
      weeklyHours: Array<{
        weekday: number;
        isClosed: boolean;
        opensAt: string | null;
        closesAt: string | null;
      }>;
      exceptionDays: Array<{
        date: string;
        isClosed: boolean;
        opensAt: string | null;
        closesAt: string | null;
        reason: string | null;
      }>;
    },
    client: PoolClient
  ) {
    await client.query('DELETE FROM organization_business_hours WHERE organization_id = $1', [
      organizationId,
    ]);
    for (const item of calendar.weeklyHours) {
      await client.query(
        `INSERT INTO organization_business_hours
           (organization_id, weekday, is_closed, opens_at, closes_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [organizationId, item.weekday, item.isClosed, item.opensAt, item.closesAt]
      );
    }
    await client.query('DELETE FROM organization_exception_days WHERE organization_id = $1', [
      organizationId,
    ]);
    for (const item of calendar.exceptionDays) {
      await client.query(
        `INSERT INTO organization_exception_days
           (organization_id, exception_date, is_closed, opens_at, closes_at, reason)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [organizationId, item.date, item.isClosed, item.opensAt, item.closesAt, item.reason]
      );
    }
  }
}

export const organizationsRepository = new OrganizationsRepository();
