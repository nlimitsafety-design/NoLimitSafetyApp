import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * PUT /api/functies/[id]
 * Update a functie (admin only)
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const { name, color, active } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    // Check duplicate (excluding self)
    const existing = await prisma.functie.findFirst({
      where: { name: name.trim(), id: { not: params.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Deze functie bestaat al' }, { status: 400 });
    }

    const functie = await prisma.functie.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        ...(color !== undefined && { color }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(functie);
  } catch (err) {
    console.error('Functies PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * DELETE /api/functies/[id]
 * Delete a functie (admin only)
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    // Check if any shifts use this functie
    const functie = await prisma.functie.findUnique({ where: { id: params.id } });
    if (!functie) {
      return NextResponse.json({ error: 'Functie niet gevonden' }, { status: 404 });
    }

    const shiftsUsingType = await prisma.shift.count({
      where: { type: functie.name },
    });

    if (shiftsUsingType > 0) {
      // Soft-delete (deactivate) instead of hard delete
      await prisma.functie.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({ 
        success: true, 
        deactivated: true,
        message: `Functie gedeactiveerd (${shiftsUsingType} diensten gebruiken deze functie)` 
      });
    }

    await prisma.functie.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Functies DELETE error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
