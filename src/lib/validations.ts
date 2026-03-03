import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten'),
});

export const employeeSchema = z.object({
  name: z.string().min(2, 'Naam moet minimaal 2 tekens bevatten'),
  email: z.string().email('Ongeldig e-mailadres'),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  hourlyRate: z.number().min(0, 'Tarief mag niet negatief zijn'),
  active: z.boolean().default(true),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten').optional(),
  functieId: z.string().nullable().optional(),
});

export const availabilitySchema = z.object({
  date: z.string().min(1, 'Datum is verplicht'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)'),
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'PARTIAL']),
  note: z.string().optional(),
});

export const recurringAvailabilitySchema = z.object({
  weekday: z.number().int().min(1).max(7), // 1=Maandag, 7=Zondag
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)'),
  validFrom: z.string().min(1, 'Geldig vanaf is verplicht'),
  validTo: z.string().nullable().optional(),
  note: z.string().optional(),
});

export const availabilityExceptionSchema = z.object({
  date: z.string().min(1, 'Datum is verplicht'),
  type: z.enum(['AVAILABLE', 'UNAVAILABLE']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)').nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)').nullable().optional(),
  note: z.string().optional(),
});

export const copyWeekSchema = z.object({
  fromWeekStartDate: z.string().min(1, 'Bron week is verplicht'),
  toWeekStartDate: z.string().min(1, 'Doel week is verplicht'),
});

export const shiftSchema = z.object({
  date: z.string().min(1, 'Datum is verplicht'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ongeldig tijdformaat (HH:mm)'),
  location: z.string().min(1, 'Locatie is verplicht'),
  type: z.string().min(1, 'Functie is verplicht'),
  note: z.string().optional(),
  status: z.enum(['CONCEPT', 'OPEN', 'TOEGEWEZEN', 'BEVESTIGD', 'AFGEROND']).default('CONCEPT'),
  employeeIds: z.array(z.string()).default([]),
}).refine(
  (data) => data.status === 'OPEN' || data.employeeIds.length > 0,
  { message: 'Minimaal één medewerker toewijzen (tenzij open dienst)', path: ['employeeIds'] }
);

export const reportFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employeeId: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type RecurringAvailabilityInput = z.infer<typeof recurringAvailabilitySchema>;
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>;
export type CopyWeekInput = z.infer<typeof copyWeekSchema>;
export type ShiftInput = z.infer<typeof shiftSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
