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
  manager_password_hash: string | null;
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
  managerPasswordHash: string;
  paymentReference: string;
  amountYen: number;
}

export class OrganizationApplicationsRepository extends BaseRepository {
  async create(params: CreateApplicationParams): Promise<OrganizationApplicationRow> {
    const rows = await this.query<OrganizationApplicationRow>(
      `INSERT INTO organization_applications (
         reference_code, legal_name, trade_name, business_type, registration_number,
         website_url, contact_name, contact_title, work_email, phone, postal_code,
         prefecture, city, address_line1, address_line2, location_count,
         expected_monthly_customers, plan_code, billing_cycle, default_locale, logo_url,
         manager_password_hash, payment_provider, payment_status, payment_reference, amount_yen
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
         $22,'demo','paid',$23,$24
       )
       RETURNING *`,
      [
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
        params.managerPasswordHash,
        params.paymentReference,
        params.amountYen,
      ]
    );
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

  async findPendingByEmail(email: string): Promise<OrganizationApplicationRow | null> {
    return this.queryOne<OrganizationApplicationRow>(
      `SELECT *
       FROM organization_applications
       WHERE LOWER(work_email) = LOWER($1) AND status = 'pending'
       LIMIT 1`,
      [email]
    );
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
           review_note = $4,
           manager_password_hash = NULL
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
           manager_password_hash = NULL,
           payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE id = $1
       RETURNING *`,
      [id, reviewerId, note]
    );
    return this.firstOrThrow(rows, 'organizationApplications.markRejected');
  }
}

export const organizationApplicationsRepository = new OrganizationApplicationsRepository();
