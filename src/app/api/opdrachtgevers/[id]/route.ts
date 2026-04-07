import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const { name, contactPerson, email, phone, address, notes, active } = body;

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    const existing = await prisma.opdrachtgever.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Opdrachtgever niet gevonden' }, { status: 404 });
    }

    const updated = await prisma.opdrachtgever.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Opdrachtgever PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const existing = await prisma.opdrachtgever.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Opdrachtgever niet gevonden' }, { status: 404 });
    }

    // Soft delete: set active = false
    await prisma.opdrachtgever.update({
      where: { id: params.id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Opdrachtgever DELETE error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
