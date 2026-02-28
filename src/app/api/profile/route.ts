import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Naam moet minimaal 2 tekens bevatten').optional(),
  phone: z.string().optional(),
  email: z.string().email('Ongeldig e-mailadres').optional(),
});

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;

  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        hourlyRate: true,
        active: true,
        createdAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;

  try {
    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, phone, email } = parsed.data;

    // If email is being changed, check for duplicates
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), id: { not: user.id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email.toLowerCase();

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Fout bij bijwerken profiel' }, { status: 500 });
  }
}
