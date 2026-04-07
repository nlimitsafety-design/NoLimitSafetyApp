import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN', 'MANAGER']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get('all') === 'true';

  const opdrachtgevers = await prisma.opdrachtgever.findMany({
    where: showAll ? {} : { active: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(opdrachtgevers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const { name, contactPerson, email, phone, address, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    const opdrachtgever = await prisma.opdrachtgever.create({
      data: {
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(opdrachtgever, { status: 201 });
  } catch (err) {
    console.error('Opdrachtgever POST error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
