import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { employeeSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function GET() {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER']);
  if (error) return error;

  try {
    const employees = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        hourlyRate: true,
        active: true,
        createdAt: true,
        userFuncties: {
          select: { functie: { select: { id: true, name: true, color: true } } },
        },
        userKwalificaties: {
          select: { kwalificatie: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Flatten relations for frontend
    const mapped = employees.map(emp => ({
      ...emp,
      functies: emp.userFuncties.map(uf => uf.functie),
      kwalificaties: emp.userKwalificaties.map(uk => uk.kwalificatie),
      userFuncties: undefined,
      userKwalificaties: undefined,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = employeeSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errors[e.path[0] as string] = e.message;
      });
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { name, email, phone, role, hourlyRate, password, functieIds, kwalificatieIds } = parsed.data;

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ errors: { email: 'Dit e-mailadres is al in gebruik' } }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ errors: { password: 'Wachtwoord is verplicht' } }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        role,
        hourlyRate,
        passwordHash,
        active: true,
        ...(functieIds && functieIds.length > 0 && {
          userFuncties: {
            create: functieIds.map((fId: string) => ({ functieId: fId })),
          },
        }),
        ...(kwalificatieIds && kwalificatieIds.length > 0 && {
          userKwalificaties: {
            create: kwalificatieIds.map((kId: string) => ({ kwalificatieId: kId })),
          },
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        hourlyRate: true,
        active: true,
        userFuncties: {
          select: { functie: { select: { id: true, name: true, color: true } } },
        },
        userKwalificaties: {
          select: { kwalificatie: { select: { id: true, name: true } } },
        },
      },
    });

    const result = {
      ...user,
      functies: user.userFuncties.map(uf => uf.functie),
      kwalificaties: user.userKwalificaties.map(uk => uk.kwalificatie),
      userFuncties: undefined,
      userKwalificaties: undefined,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
