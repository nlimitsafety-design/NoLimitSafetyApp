import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

function createPrisma(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
}

const prisma = createPrisma();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.shiftRequest.deleteMany();
  await prisma.shiftUser.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.availabilityException.deleteMany();
  await prisma.recurringAvailability.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.functie.deleteMany();

  // Create functies
  await Promise.all([
    prisma.functie.create({ data: { name: 'Toezicht', color: '#f97316' } }),
    prisma.functie.create({ data: { name: 'Training', color: '#3b82f6' } }),
    prisma.functie.create({ data: { name: 'Evenement', color: '#a855f7' } }),
    prisma.functie.create({ data: { name: 'Beveiliging', color: '#22c55e' } }),
  ]);

  // Create locations
  const locations = await Promise.all([
    prisma.location.create({ data: { name: 'Rotterdam Centraal', address: 'Stationsplein 1, Rotterdam' } }),
    prisma.location.create({ data: { name: 'Ahoy Rotterdam', address: 'Ahoyweg 10, Rotterdam' } }),
    prisma.location.create({ data: { name: 'Shell Pernis', address: 'Vondelingenweg 601, Rotterdam' } }),
    prisma.location.create({ data: { name: 'Europoort Terminal', address: 'Europoort, Rotterdam' } }),
    prisma.location.create({ data: { name: 'Schiphol Airport', address: 'Evert van de Beekstraat 202, Schiphol' } }),
  ]);

  // Create users
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const employeePassword = await bcrypt.hash('Welkom123!', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Jan de Vries',
      email: 'admin@securityapp.nl',
      phone: '+31 6 12345678',
      passwordHash: adminPassword,
      role: 'ADMIN',
      hourlyRate: 45.0,
      active: true,
    },
  });

  const employee1 = await prisma.user.create({
    data: {
      name: 'Pieter Bakker',
      email: 'pieter@securityapp.nl',
      phone: '+31 6 23456789',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      hourlyRate: 28.5,
      active: true,
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      name: 'Maria Jansen',
      email: 'maria@securityapp.nl',
      phone: '+31 6 34567890',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      hourlyRate: 32.0,
      active: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Kees van Dijk',
      email: 'kees@securityapp.nl',
      phone: '+31 6 45678901',
      passwordHash: employeePassword,
      role: 'MANAGER',
      hourlyRate: 38.0,
      active: true,
    },
  });

  // Create recurring availability (vaste beschikbaarheid)
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const validFrom = new Date(startOfWeek);
  validFrom.setHours(0, 0, 0, 0);

  // Pieter: weekdays morning 06:00–14:00
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.recurringAvailability.create({
      data: {
        userId: employee1.id,
        weekday,
        startTime: '06:00',
        endTime: '14:00',
        validFrom,
        validTo: null,
        note: weekday === 5 ? 'Vrijdag liefst tot 12:00' : undefined,
      },
    });
  }

  // Maria: weekdays afternoon 14:00–22:00
  for (let weekday = 1; weekday <= 5; weekday++) {
    if (weekday === 3) continue; // Skip woensdag (handled by exception)
    await prisma.recurringAvailability.create({
      data: {
        userId: employee2.id,
        weekday,
        startTime: '14:00',
        endTime: '22:00',
        validFrom,
        validTo: null,
      },
    });
  }

  // Maria: woensdag exception (not available)
  const wednesdayExcDate = new Date(startOfWeek);
  wednesdayExcDate.setDate(startOfWeek.getDate() + 2);
  wednesdayExcDate.setHours(0, 0, 0, 0);

  await prisma.availabilityException.create({
    data: {
      userId: employee2.id,
      date: wednesdayExcDate,
      type: 'UNAVAILABLE',
      startTime: null,
      endTime: null,
      note: 'Woensdag niet beschikbaar - afspraak',
    },
  });

  // Create shifts for this week
  const shift1 = await prisma.shift.create({
    data: {
      date: new Date(new Date(startOfWeek).setHours(0, 0, 0, 0)),
      startTime: '07:00',
      endTime: '15:00',
      location: 'Shell Pernis',
      type: 'Toezicht',
      note: 'Toegangscontrole hoofdpoort',
      status: 'BEVESTIGD',
    },
  });

  const tuesdayDate = new Date(startOfWeek);
  tuesdayDate.setDate(startOfWeek.getDate() + 1);
  tuesdayDate.setHours(0, 0, 0, 0);

  const shift2 = await prisma.shift.create({
    data: {
      date: tuesdayDate,
      startTime: '08:00',
      endTime: '17:00',
      location: 'Ahoy Rotterdam',
      type: 'Evenement',
      note: 'Bouwbeurs beveiligen',
      status: 'BEVESTIGD',
    },
  });

  const wednesdayDate = new Date(startOfWeek);
  wednesdayDate.setDate(startOfWeek.getDate() + 2);
  wednesdayDate.setHours(0, 0, 0, 0);

  const shift3 = await prisma.shift.create({
    data: {
      date: wednesdayDate,
      startTime: '09:00',
      endTime: '13:00',
      location: 'Rotterdam Centraal',
      type: 'Training',
      note: 'BHV training nieuwe medewerkers',
      status: 'CONCEPT',
    },
  });

  const thursdayDate = new Date(startOfWeek);
  thursdayDate.setDate(startOfWeek.getDate() + 3);
  thursdayDate.setHours(0, 0, 0, 0);

  const shift4 = await prisma.shift.create({
    data: {
      date: thursdayDate,
      startTime: '06:00',
      endTime: '14:00',
      location: 'Europoort Terminal',
      type: 'Toezicht',
      note: 'Nachtdienst aflossing',
      status: 'BEVESTIGD',
    },
  });

  const fridayDate = new Date(startOfWeek);
  fridayDate.setDate(startOfWeek.getDate() + 4);
  fridayDate.setHours(0, 0, 0, 0);

  const shift5 = await prisma.shift.create({
    data: {
      date: fridayDate,
      startTime: '15:00',
      endTime: '23:00',
      location: 'Ahoy Rotterdam',
      type: 'Evenement',
      note: 'Concert beveiligen',
      status: 'CONCEPT',
    },
  });

  // Assign employees to shifts
  await prisma.shiftUser.createMany({
    data: [
      { shiftId: shift1.id, userId: employee1.id },
      { shiftId: shift2.id, userId: employee1.id },
      { shiftId: shift2.id, userId: employee2.id },
      { shiftId: shift3.id, userId: employee1.id },
      { shiftId: shift3.id, userId: employee2.id },
      { shiftId: shift3.id, userId: manager.id },
      { shiftId: shift4.id, userId: employee1.id },
      { shiftId: shift5.id, userId: employee2.id },
    ],
  });

  console.log('✅ Seed completed!');
  console.log('');
  console.log('📋 Login accounts:');
  console.log('  Admin:       admin@securityapp.nl / Admin123!');
  console.log('  Medewerker:  pieter@securityapp.nl / Welkom123!');
  console.log('  Medewerker:  maria@securityapp.nl / Welkom123!');
  console.log('  Manager:     kees@securityapp.nl / Welkom123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
