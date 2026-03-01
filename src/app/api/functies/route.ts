import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * GET /api/functies
 * Get all functies (active only by default, ?all=true for all)
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN', 'MANAGER', 'EMPLOYEE']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get('all') === 'true';

  try {
    const functies = await prisma.functie.findMany({
      where: showAll ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(functies);
  } catch (err) {
    console.error('Functies GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/functies
 * Create a new functie (admin only)
 * Body: { name: string, color?: string }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const { name, color } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
    }

    // Check duplicate
    const existing = await prisma.functie.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Deze functie bestaat al' }, { status: 400 });
    }

    const functie = await prisma.functie.create({
      data: {
        name: name.trim(),
        color: color || '#f97316',
      },
    });

    return NextResponse.json(functie, { status: 201 });
  } catch (err) {
    console.error('Functies POST error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
