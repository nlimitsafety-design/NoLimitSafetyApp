import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { employeeSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireRole(['ADMIN']);
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

    const { name, email, phone, role, hourlyRate, active, password, functieId } = parsed.data;

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
    if (functieId !== undefined) updateData.functieId = functieId || null;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

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
        functieId: true,
        functie: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Update employee error:', error);
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
  } catch (error) {
    return NextResponse.json({ error: 'Kon medewerker niet verwijderen' }, { status: 500 });
  }
}
