import { randomBytes, randomUUID } from 'node:crypto';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { issueAccountAction } from '../account-lifecycle/account-lifecycle.service';

import {
  type OrganizationApplicationRow,
  organizationApplicationsRepository,
} from './organization-applications.repository';
import type {
  CreateOrganizationApplicationDto,
  OrganizationApplicationStatusFilter,
  ReviewOrganizationApplicationDto,
  UpdateOrganizationApplicationDto,
} from './organization-applications.validator';

const MONTHLY_PLAN_PRICES = {
  starter: 9_800,
  standard: 29_800,
  scale: 59_800,
} as const;

function calculateAmount(
  planCode: keyof typeof MONTHLY_PLAN_PRICES,
  billingCycle: 'monthly' | 'annual'
) {
  const monthly = MONTHLY_PLAN_PRICES[planCode];
  return billingCycle === 'annual' ? monthly * 10 : monthly;
}

function buildReferenceCode() {
  return `SQA-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function toSlugPart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
}

function buildOrganizationSlug(application: OrganizationApplicationRow) {
  const base = toSlugPart(application.trade_name) || 'organization';
  return `${base}-${application.reference_code.slice(-8).toLowerCase()}`;
}

function assertPending(application: OrganizationApplicationRow | null) {
  if (!application) throw AppError.notFound('Organization application');
  if (application.status !== 'pending') {
    throw AppError.conflict('This organization application has already been reviewed');
  }
  return application;
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export const organizationApplicationsService = {
  async submit(dto: CreateOrganizationApplicationDto) {
    const [pendingApplication, existingUser] = await Promise.all([
      organizationApplicationsRepository.findPendingByEmail(dto.workEmail),
      usersRepository.findByEmail(dto.workEmail),
    ]);
    if (pendingApplication) {
      throw AppError.conflict('A pending application already exists for this work email');
    }
    if (existingUser) {
      throw AppError.conflict('An account with this work email already exists');
    }

    let application: OrganizationApplicationRow;
    try {
      application = await organizationApplicationsRepository.create({
        referenceCode: buildReferenceCode(),
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        businessType: dto.businessType,
        registrationNumber: dto.registrationNumber,
        websiteUrl: dto.websiteUrl,
        contactName: dto.contactName,
        contactTitle: dto.contactTitle,
        workEmail: dto.workEmail,
        phone: dto.phone,
        postalCode: dto.postalCode,
        prefecture: dto.prefecture,
        city: dto.city,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        locationCount: dto.locationCount,
        expectedMonthlyCustomers: dto.expectedMonthlyCustomers,
        planCode: dto.planCode,
        billingCycle: dto.billingCycle,
        defaultLocale: dto.defaultLocale,
        logoUrl: dto.logoUrl,
        paymentReference: `demo-${randomUUID()}`,
        amountYen: calculateAmount(dto.planCode, dto.billingCycle),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A pending application already exists for this work email');
      }
      throw error;
    }

    return {
      id: application.id,
      referenceCode: application.reference_code,
      status: application.status,
      paymentStatus: application.payment_status,
      amountYen: application.amount_yen,
      submittedAt: application.submitted_at,
    };
  },

  async list(status: OrganizationApplicationStatusFilter) {
    const applications = await organizationApplicationsRepository.list(status);
    return applications;
  },

  async update(applicationId: string, dto: UpdateOrganizationApplicationDto) {
    return withTransaction(async (client) => {
      assertPending(
        await organizationApplicationsRepository.findByIdForUpdate(applicationId, client)
      );
      const [existingUser, pendingApplication] = await Promise.all([
        usersRepository.findByEmail(dto.workEmail, client),
        organizationApplicationsRepository.findPendingByEmail(dto.workEmail, client),
      ]);
      if (existingUser) {
        throw AppError.conflict('An account with this work email already exists');
      }
      if (pendingApplication && pendingApplication.id !== applicationId) {
        throw AppError.conflict('A pending application already exists for this work email');
      }
      return organizationApplicationsRepository.updatePending(
        applicationId,
        {
          ...dto,
          amountYen: calculateAmount(dto.planCode, dto.billingCycle),
        },
        client
      );
    });
  },

  async approve(applicationId: string, reviewerId: string, dto: ReviewOrganizationApplicationDto) {
    try {
      return await withTransaction(async (client) => {
        const application = assertPending(
          await organizationApplicationsRepository.findByIdForUpdate(applicationId, client)
        );
        if (application.payment_status !== 'paid') {
          throw AppError.conflict('The application payment has not been completed');
        }
        const existingUser = await usersRepository.findByEmail(application.work_email, client);
        if (existingUser) {
          throw AppError.conflict('An account with this work email already exists');
        }

        const slug = buildOrganizationSlug(application);
        const organization = await organizationsRepository.create(
          {
            name: application.trade_name,
            defaultLocale: application.default_locale,
            slug,
            publicQrToken: `org-${randomUUID()}`,
            logoUrl: application.logo_url,
            phone: application.phone,
            postalCode: application.postal_code,
            prefecture: application.prefecture,
            city: application.city,
            addressLine1: application.address_line1,
            addressLine2: application.address_line2,
            address: [
              application.postal_code,
              application.prefecture,
              application.city,
              application.address_line1,
              application.address_line2,
            ]
              .filter(Boolean)
              .join(' '),
            paymentInfo: null,
            settings: {
              subscriptionPlan: application.plan_code,
              billingCycle: application.billing_cycle,
              applicationReference: application.reference_code,
            },
            isActive: false,
            activationStatus: 'pending_activation',
          },
          client
        );

        const manager = await usersRepository.createInvited(
          {
            displayName: application.contact_name,
            email: application.work_email,
            phone: application.phone,
            role: 'manager',
            jobTitle: application.contact_title,
            invitedBy: reviewerId,
          },
          client
        );
        await organizationsRepository.addMember(organization.id, manager.id, 'manager', client, {
          isActive: false,
          isOwner: true,
        });
        await issueAccountAction(
          {
            userId: manager.id,
            recipientEmail: application.work_email,
            displayName: application.contact_name,
            organizationName: application.trade_name,
            locale: application.default_locale,
            purpose: 'account_activation',
            createdBy: reviewerId,
          },
          client
        );
        const reviewedApplication = await organizationApplicationsRepository.markApproved(
          application.id,
          organization.id,
          reviewerId,
          dto.note ?? null,
          client
        );

        return {
          application: reviewedApplication,
          organization,
          manager: {
            id: manager.id,
            display_name: manager.display_name,
            email: manager.email,
            role: manager.role,
          },
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict(
          'The organization or manager account conflicts with an existing record'
        );
      }
      throw error;
    }
  },

  async reject(applicationId: string, reviewerId: string, dto: ReviewOrganizationApplicationDto) {
    return withTransaction(async (client) => {
      const application = assertPending(
        await organizationApplicationsRepository.findByIdForUpdate(applicationId, client)
      );
      return organizationApplicationsRepository.markRejected(
        application.id,
        reviewerId,
        dto.note ?? null,
        client
      );
    });
  },
};
