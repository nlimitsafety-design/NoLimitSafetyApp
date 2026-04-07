import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * GET /api/kwalificaties
 * Get all kwalificaties (active only by default, ?all=true for all)
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN', 'MANAGER', 'EMPLOYEE']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get('all') === 'true';

  try {
    const kwalificaties = await prisma.kwalificatie.findMany({
      where: showAll ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(kwalificaties);
  } catch (err) {
    console.error('Kwalificaties GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/kwalificaties
 * Create a new kwalificatie (admin only)
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    const existing = await prisma.kwalificatie.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Deze kwalificatie bestaat al' }, { status: 400 });
    }

    const kwalificatie = await prisma.kwalificatie.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(kwalificatie, { status: 201 });
  } catch (err) {
    console.error('Kwalificaties POST error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
