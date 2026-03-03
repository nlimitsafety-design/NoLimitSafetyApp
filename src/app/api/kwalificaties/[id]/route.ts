import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * PUT /api/kwalificaties/[id]
 * Update a kwalificatie (admin only)
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const { name, active } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    const existing = await prisma.kwalificatie.findFirst({
      where: { name: name.trim(), id: { not: params.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Deze kwalificatie bestaat al' }, { status: 400 });
    }

    const kwalificatie = await prisma.kwalificatie.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(kwalificatie);
  } catch (err) {
    console.error('Kwalificaties PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * DELETE /api/kwalificaties/[id]
 * Delete a kwalificatie (admin only)
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const kwalificatie = await prisma.kwalificatie.findUnique({ where: { id: params.id } });
    if (!kwalificatie) {
      return NextResponse.json({ error: 'Kwalificatie niet gevonden' }, { status: 404 });
    }

    // Check if any users have this qualification
    const usersWithKwal = await prisma.userKwalificatie.count({
      where: { kwalificatieId: params.id },
    });

    if (usersWithKwal > 0) {
      // Soft-delete (deactivate)
      await prisma.kwalificatie.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({
        success: true,
        deactivated: true,
        message: `Kwalificatie gedeactiveerd (${usersWithKwal} medewerkers hebben deze kwalificatie)`,
      });
    }

    await prisma.kwalificatie.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Kwalificaties DELETE error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
