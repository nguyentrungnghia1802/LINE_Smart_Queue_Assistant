import { z } from 'zod';

import { JapanesePhoneSchema } from '../shared/shared.validator';

export const UpdateOrgSettingsSchema = z.object({
  defaultLocale: z.enum(['ja', 'vi', 'en']).optional(),
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  postalCode: z
    .string()
    .regex(/^[0-9]{3}-?[0-9]{4}$/)
    .nullable()
    .optional(),
  prefecture: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: JapanesePhoneSchema.nullable().optional(),
  paymentInfo: z.string().max(2000).nullable().optional(),
  settings: z
    .object({
      businessHours: z
        .object({
          open: z.string().max(10).optional(),
          close: z.string().max(10).optional(),
          holidays: z.string().max(500).optional(),
        })
        .optional(),
      paymentProvider: z
        .object({
          provider: z.string().max(80).optional(),
          merchantId: z.string().max(120).optional(),
          demoMode: z.boolean().optional(),
        })
        .optional(),
      notificationPreferences: z
        .object({
          lineEnabled: z.boolean().optional(),
          retryEnabled: z.boolean().optional(),
          notifyBeforeTurns: z.number().int().min(1).max(20).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type UpdateOrgSettingsDto = z.infer<typeof UpdateOrgSettingsSchema>;

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const BusinessCalendarSchema = z
  .object({
    weeklyHours: z
      .array(
        z.object({
          weekday: z.number().int().min(0).max(6),
          isClosed: z.boolean(),
          opensAt: TimeSchema.nullable(),
          closesAt: TimeSchema.nullable(),
        })
      )
      .length(7),
    exceptionDays: z
      .array(
        z.object({
          date: z.string().date(),
          isClosed: z.boolean(),
          opensAt: TimeSchema.nullable(),
          closesAt: TimeSchema.nullable(),
          reason: z.string().max(200).nullable(),
        })
      )
      .max(100),
  })
  .superRefine((calendar, ctx) => {
    if (new Set(calendar.weeklyHours.map((item) => item.weekday)).size !== 7) {
      ctx.addIssue({ code: 'custom', message: 'Weekdays must be unique' });
    }
    for (const item of [...calendar.weeklyHours, ...calendar.exceptionDays]) {
      if (item.isClosed && (item.opensAt || item.closesAt)) {
        ctx.addIssue({ code: 'custom', message: 'Closed days cannot define business hours' });
      }
      if (!item.isClosed && (!item.opensAt || !item.closesAt || item.opensAt >= item.closesAt)) {
        ctx.addIssue({ code: 'custom', message: 'Enter valid business hours' });
      }
    }
  });

export type BusinessCalendarDto = z.infer<typeof BusinessCalendarSchema>;
