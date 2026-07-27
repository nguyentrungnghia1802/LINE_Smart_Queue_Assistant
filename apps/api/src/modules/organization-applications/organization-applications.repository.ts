import type { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { BaseRepository } from '../../db/repositories/base.repository';

export type OrganizationApplicationStatus = 'pending' | 'approved' | 'rejected';
export type OrganizationApplicationPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrganizationApplicationRow {
  id: string;
  reference_code: string;
  status: OrganizationApplicationStatus;
  legal_name: string;
  trade_name: string;
  business_type: string;
  registration_number: string | null;
  website_url: string | null;
  contact_name: string;
  contact_title: string | null;
  work_email: string;
  phone: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  location_count: number;
  expected_monthly_customers: number;
  plan_code: 'starter' | 'standard' | 'scale';
  billing_cycle: 'monthly' | 'annual';
  default_locale: SupportedLocale;
  logo_url: string | null;
  payment_provider: string;
  payment_status: OrganizationApplicationPaymentStatus;
  payment_reference: string;
  amount_yen: number;
  organization_id: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  submitted_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface CreateApplicationParams {
  referenceCode: string;
  legalName: string;
  tradeName: string;
  businessType: string;
  registrationNumber?: string | null;
  websiteUrl?: string | null;
  contactName: string;
  contactTitle?: string | null;
  workEmail: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2?: string | null;
  locationCount: number;
  expectedMonthlyCustomers: number;
  planCode: 'starter' | 'standard' | 'scale';
  billingCycle: 'monthly' | 'annual';
  defaultLocale: SupportedLocale;
  logoUrl?: string | null;
  paymentReference: string;
  amountYen: number;
}

type UpdateApplicationParams = Omit<
  CreateApplicationParams,
  'referenceCode' | 'paymentReference' | 'amountYen'
> & { amountYen: number };

export class OrganizationApplicationsRepository extends BaseRepository {
  async getAdminDashboard(): Promise<{
    organizationCount: number;
    pendingApplicationCount: number;
    totalRevenue: number;
    planCounts: Record<'starter' | 'standard' | 'scale', number>;
    monthlyRevenue: Array<{ month: string; revenue: number }>;
  }> {
    const [summary, monthly] = await Promise.all([
      this.query<{
        organization_count: string;
        pending_count: string;
        total_revenue: string;
        starter_count: string;
        standard_count: string;
        scale_count: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM organizations WHERE is_active = TRUE)::TEXT
             AS organization_count,
           COUNT(*) FILTER (WHERE application.status = 'pending')::TEXT AS pending_count,
           COALESCE(SUM(application.amount_yen) FILTER (
             WHERE application.status = 'approved' AND application.payment_status = 'paid'
           ), 0)::TEXT AS total_revenue,
           COUNT(*) FILTER (
             WHERE application.status = 'approved'
               AND application.plan_code = 'starter'
               AND EXISTS (
                 SELECT 1 FROM organizations active_org
                 WHERE active_org.id = application.organization_id
                   AND active_org.is_active = TRUE
               )
           )::TEXT
             AS starter_count,
           COUNT(*) FILTER (
             WHERE application.status = 'approved'
               AND application.plan_code = 'standard'
               AND EXISTS (
                 SELECT 1 FROM organizations active_org
                 WHERE active_org.id = application.organization_id
                   AND active_org.is_active = TRUE
               )
           )::TEXT
             AS standard_count,
           COUNT(*) FILTER (
             WHERE application.status = 'approved'
               AND application.plan_code = 'scale'
               AND EXISTS (
                 SELECT 1 FROM organizations active_org
                 WHERE active_org.id = application.organization_id
                   AND active_org.is_active = TRUE
               )
           )::TEXT
             AS scale_count
         FROM organization_applications application`
      ),
      this.query<{ month: string; revenue: string }>(
        `WITH months AS (
           SELECT generate_series(
             DATE_TRUNC('month', NOW()) - INTERVAL '11 months',
             DATE_TRUNC('month', NOW()),
             INTERVAL '1 month'
           ) AS month
         )
         SELECT TO_CHAR(months.month, 'YYYY-MM') AS month,
                COALESCE(SUM(application.amount_yen), 0)::TEXT AS revenue
         FROM months
         LEFT JOIN organization_applications application
           ON DATE_TRUNC('month', application.reviewed_at) = months.month
          AND application.status = 'approved'
          AND application.payment_status = 'paid'
         GROUP BY months.month
         ORDER BY months.month`
      ),
    ]);
    const row = summary[0];
    return {
      organizationCount: Number(row?.organization_count ?? 0),
      pendingApplicationCount: Number(row?.pending_count ?? 0),
      totalRevenue: Number(row?.total_revenue ?? 0),
      planCounts: {
        starter: Number(row?.starter_count ?? 0),
        standard: Number(row?.standard_count ?? 0),
        scale: Number(row?.scale_count ?? 0),
      },
      monthlyRevenue: monthly.map((item) => ({
        month: item.month,
        revenue: Number(item.revenue),
      })),
    };
  }

  async create(
    params: CreateApplicationParams,
    client?: PoolClient
  ): Promise<OrganizationApplicationRow> {
    const sql = `INSERT INTO organization_applications (
       reference_code, legal_name, trade_name, business_type, registration_number,
       website_url, contact_name, contact_title, work_email, phone, postal_code,
       prefecture, city, address_line1, address_line2, location_count,
       expected_monthly_customers, plan_code, billing_cycle, default_locale, logo_url,
       payment_provider, payment_status, payment_reference, amount_yen
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
       'demo','paid',$22,$23
     )
     RETURNING *`;
    const values = [
      params.referenceCode,
      params.legalName,
      params.tradeName,
      params.businessType,
      params.registrationNumber ?? null,
      params.websiteUrl ?? null,
      params.contactName,
      params.contactTitle ?? null,
      params.workEmail,
      params.phone,
      params.postalCode,
      params.prefecture,
      params.city,
      params.addressLine1,
      params.addressLine2 ?? null,
      params.locationCount,
      params.expectedMonthlyCustomers,
      params.planCode,
      params.billingCycle,
      params.defaultLocale,
      params.logoUrl ?? null,
      params.paymentReference,
      params.amountYen,
    ];
    const rows = client
      ? await this.queryTx<OrganizationApplicationRow>(client, sql, values)
      : await this.query<OrganizationApplicationRow>(sql, values);
    return this.firstOrThrow(rows, 'organizationApplications.create');
  }

  async list(status: OrganizationApplicationStatus | 'all'): Promise<OrganizationApplicationRow[]> {
    return this.query<OrganizationApplicationRow>(
      `SELECT *
       FROM organization_applications
       WHERE ($1 = 'all' OR status = $1)
       ORDER BY
         CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
         submitted_at DESC
       LIMIT 200`,
      [status]
    );
  }

  async updatePending(
    id: string,
    params: UpdateApplicationParams,
    client: PoolClient
  ): Promise<OrganizationApplicationRow> {
    const rows = await this.queryTx<OrganizationApplicationRow>(
      client,
      `UPDATE organization_applications
       SET legal_name = $2, trade_name = $3, business_type = $4,
           registration_number = $5, website_url = $6, contact_name = $7,
           contact_title = $8, work_email = $9, phone = $10, postal_code = $11,
           prefecture = $12, city = $13, address_line1 = $14, address_line2 = $15,
           location_count = $16, expected_monthly_customers = $17, plan_code = $18,
           billing_cycle = $19, default_locale = $20, logo_url = $21,
           amount_yen = $22, updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [
        id,
        params.legalName,
        params.tradeName,
        params.businessType,
        params.registrationNumber ?? null,
        params.websiteUrl ?? null,
        params.contactName,
        params.contactTitle ?? null,
        params.workEmail,
        params.phone,
        params.postalCode,
        params.prefecture,
        params.city,
        params.addressLine1,
        params.addressLine2 ?? null,
        params.locationCount,
        params.expectedMonthlyCustomers,
        params.planCode,
        params.billingCycle,
        params.defaultLocale,
        params.logoUrl ?? null,
        params.amountYen,
      ]
    );
    return this.firstOrThrow(rows, 'organizationApplications.updatePending');
  }

  async findPendingByEmail(
    email: string,
    client?: PoolClient
  ): Promise<OrganizationApplicationRow | null> {
    const sql = `SELECT *
       FROM organization_applications
       WHERE LOWER(work_email) = LOWER($1) AND status = 'pending'
       LIMIT 1`;
    return client
      ? this.queryOneTx<OrganizationApplicationRow>(client, sql, [email])
      : this.queryOne<OrganizationApplicationRow>(sql, [email]);
  }

  async findByIdForUpdate(
    id: string,
    client: PoolClient
  ): Promise<OrganizationApplicationRow | null> {
    return this.queryOneTx<OrganizationApplicationRow>(
      client,
      'SELECT * FROM organization_applications WHERE id = $1 FOR UPDATE',
      [id]
    );
  }

  async markApproved(
    id: string,
    organizationId: string,
    reviewerId: string,
    note: string | null,
    client: PoolClient
  ): Promise<OrganizationApplicationRow> {
    const rows = await this.queryTx<OrganizationApplicationRow>(
      client,
      `UPDATE organization_applications
       SET status = 'approved',
           organization_id = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           review_note = $4
       WHERE id = $1
       RETURNING *`,
      [id, organizationId, reviewerId, note]
    );
    return this.firstOrThrow(rows, 'organizationApplications.markApproved');
  }

  async markRejected(
    id: string,
    reviewerId: string,
    note: string | null,
    client: PoolClient
  ): Promise<OrganizationApplicationRow> {
    const rows = await this.queryTx<OrganizationApplicationRow>(
      client,
      `UPDATE organization_applications
       SET status = 'rejected',
           reviewed_by = $2,
           reviewed_at = NOW(),
           review_note = $3,
           payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE id = $1
       RETURNING *`,
      [id, reviewerId, note]
    );
    return this.firstOrThrow(rows, 'organizationApplications.markRejected');
  }
}

export const organizationApplicationsRepository = new OrganizationApplicationsRepository();
