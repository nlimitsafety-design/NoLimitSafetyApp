import { availabilitySchema, shiftSchema, employeeSchema, loginSchema } from '@/lib/validations';

describe('loginSchema', () => {
  it('validates correct login data', () => {
    const result = loginSchema.safeParse({ email: 'test@test.nl', password: 'Test123!' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: 'Test123!' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@test.nl', password: '12' });
    expect(result.success).toBe(false);
  });
});

describe('employeeSchema', () => {
  it('validates correct employee data', () => {
    const result = employeeSchema.safeParse({
      name: 'Jan Janssen',
      email: 'jan@test.nl',
      role: 'EMPLOYEE',
      hourlyRate: 28.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = employeeSchema.safeParse({
      name: 'Jan',
      email: 'jan@test.nl',
      role: 'SUPERADMIN',
      hourlyRate: 28.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative hourlyRate', () => {
    const result = employeeSchema.safeParse({
      name: 'Jan Janssen',
      email: 'jan@test.nl',
      role: 'EMPLOYEE',
      hourlyRate: -5,
    });
    expect(result.success).toBe(false);
  });
});

describe('availabilitySchema', () => {
  it('validates correct availability data', () => {
    const result = availabilitySchema.safeParse({
      date: '2026-03-01',
      startTime: '06:00',
      endTime: '14:00',
      status: 'AVAILABLE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid time format', () => {
    const result = availabilitySchema.safeParse({
      date: '2026-03-01',
      startTime: '6am',
      endTime: '2pm',
      status: 'AVAILABLE',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = availabilitySchema.safeParse({
      date: '2026-03-01',
      startTime: '06:00',
      endTime: '14:00',
      status: 'MAYBE',
    });
    expect(result.success).toBe(false);
  });
});

describe('shiftSchema', () => {
  it('validates correct shift data', () => {
    const result = shiftSchema.safeParse({
      date: '2026-03-01',
      startTime: '08:00',
      endTime: '17:00',
      location: 'Shell Pernis',
      type: 'TOEZICHT',
      status: 'CONCEPT',
      employeeIds: ['user1'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty employeeIds', () => {
    const result = shiftSchema.safeParse({
      date: '2026-03-01',
      startTime: '08:00',
      endTime: '17:00',
      location: 'Shell Pernis',
      type: 'TOEZICHT',
      status: 'CONCEPT',
      employeeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing location', () => {
    const result = shiftSchema.safeParse({
      date: '2026-03-01',
      startTime: '08:00',
      endTime: '17:00',
      location: '',
      type: 'TOEZICHT',
      status: 'CONCEPT',
      employeeIds: ['user1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = shiftSchema.safeParse({
      date: '2026-03-01',
      startTime: '08:00',
      endTime: '17:00',
      location: 'Shell Pernis',
      type: 'INVALID',
      status: 'CONCEPT',
      employeeIds: ['user1'],
    });
    expect(result.success).toBe(false);
  });
});
