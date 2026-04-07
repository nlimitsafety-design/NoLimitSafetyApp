import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * GET /api/toeslagen
 * Get all toeslagen (active only by default, ?all=true for all)
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN', 'MANAGER', 'EMPLOYEE']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get('all') === 'true';

  try {
    const toeslagen = await prisma.toeslag.findMany({
      where: showAll ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(toeslagen);
  } catch (err) {
    console.error('Toeslagen GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/toeslagen
 * Create a new toeslag (admin only)
 * Body: { name, type, startTime?, endTime?, days?, percentage }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const { name, type, startTime, endTime, days, percentage } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }
    if (!type || !['TIME_BASED', 'DAY_BASED'].includes(type)) {
      return NextResponse.json({ error: 'Type moet TIME_BASED of DAY_BASED zijn' }, { status: 400 });
    }
    if (typeof percentage !== 'number' || percentage < 100) {
      return NextResponse.json({ error: 'Percentage moet groter dan 100 zijn (bijv. 130 = 130%)' }, { status: 400 });
    }
    if (type === 'TIME_BASED' && (!startTime || !endTime)) {
      return NextResponse.json({ error: 'Starttijd en eindtijd zijn verplicht voor tijdgebaseerde toeslagen' }, { status: 400 });
    }
    if (type === 'DAY_BASED' && !days) {
      return NextResponse.json({ error: 'Dagen zijn verplicht voor daggebaseerde toeslagen' }, { status: 400 });
    }

    // Check duplicate
    const existing = await prisma.toeslag.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Deze toeslag bestaat al' }, { status: 400 });
    }

    // Get highest sortOrder
    const maxSort = await prisma.toeslag.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = (maxSort?.sortOrder ?? 0) + 1;

    const toeslag = await prisma.toeslag.create({
      data: {
        name: name.trim(),
        type,
        startTime: type === 'TIME_BASED' ? startTime : null,
        endTime: type === 'TIME_BASED' ? endTime : null,
        days: type === 'DAY_BASED' ? days : null,
        percentage,
        sortOrder,
      },
    });

    return NextResponse.json(toeslag, { status: 201 });
  } catch (err) {
    console.error('Toeslagen POST error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
