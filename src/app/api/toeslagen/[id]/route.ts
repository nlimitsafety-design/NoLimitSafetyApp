import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * PUT /api/toeslagen/[id]
 * Update a toeslag (admin only)
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const { name, type, startTime, endTime, days, percentage, active } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    // Check duplicate (excluding self)
    const existing = await prisma.toeslag.findFirst({
      where: { name: name.trim(), id: { not: params.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Deze toeslag bestaat al' }, { status: 400 });
    }

    const toeslag = await prisma.toeslag.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        ...(type !== undefined && { type }),
        ...(type === 'TIME_BASED' && { startTime, endTime, days: null }),
        ...(type === 'DAY_BASED' && { startTime: null, endTime: null, days }),
        ...(percentage !== undefined && { percentage }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(toeslag);
  } catch (err) {
    console.error('Toeslagen PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * DELETE /api/toeslagen/[id]
 * Delete a toeslag (admin only)
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const toeslag = await prisma.toeslag.findUnique({ where: { id: params.id } });
    if (!toeslag) {
      return NextResponse.json({ error: 'Toeslag niet gevonden' }, { status: 404 });
    }

    await prisma.toeslag.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Toeslagen DELETE error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
