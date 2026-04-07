import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { employeeSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = employeeSchema.partial().safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errors[e.path[0] as string] = e.message;
      });
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { name, email, phone, role, hourlyRate, active, password, functieIds, kwalificatieIds } = parsed.data;

    // Check duplicate email (exclude current user)
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), id: { not: params.id } },
      });
      if (existing) {
        return NextResponse.json({ errors: { email: 'Dit e-mailadres is al in gebruik' } }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone || null;
    if (role !== undefined) updateData.role = role;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
    if (active !== undefined) updateData.active = active;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    // Handle functies and kwalificaties in a transaction to prevent data loss
    await prisma.$transaction(async (tx) => {
      if (functieIds !== undefined) {
        await tx.userFunctie.deleteMany({ where: { userId: params.id } });
        if (functieIds.length > 0) {
          await tx.userFunctie.createMany({
            data: functieIds.map((fId: string) => ({ userId: params.id, functieId: fId })),
          });
        }
      }

      if (kwalificatieIds !== undefined) {
        await tx.userKwalificatie.deleteMany({ where: { userId: params.id } });
        if (kwalificatieIds.length > 0) {
          await tx.userKwalificatie.createMany({
            data: kwalificatieIds.map((kId: string) => ({ userId: params.id, kwalificatieId: kId })),
          });
        }
      }
    });

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(result);
  } catch (err) {
    console.error('Update employee error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireRole(['ADMIN']);
  if (error) return error;

  // Prevent admin from deleting their own account
  const currentUserId = (session!.user as any).id;
  if (params.id === currentUserId) {
    return NextResponse.json({ error: 'Je kunt je eigen account niet verwijderen' }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Kon medewerker niet verwijderen' }, { status: 500 });
  }
}
