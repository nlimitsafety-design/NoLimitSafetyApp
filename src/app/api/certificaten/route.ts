import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

/**
 * GET /api/certificaten
 * Medewerker: eigen certificaten
 * Admin/Manager: ?userId=... voor specifieke medewerker, of ?all=true voor iedereen
 */
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId');
  const all = searchParams.get('all') === 'true';

  try {
    if (all && (role === 'ADMIN' || role === 'MANAGER')) {
      const certificaten = await prisma.certificaat.findMany({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ expiryDate: 'asc' }],
      });
      return NextResponse.json(certificaten);
    }

    const queryUserId =
      targetUserId && (role === 'ADMIN' || role === 'MANAGER')
        ? targetUserId
        : userId;

    const certificaten = await prisma.certificaat.findMany({
      where: { userId: queryUserId },
      orderBy: [{ expiryDate: 'asc' }],
    });

    return NextResponse.json(certificaten);
  } catch (err) {
    console.error('Certificaten GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/certificaten
 * Medewerker voegt een certificaat toe voor zichzelf.
 * Admin/Manager kan ook voor anderen aanmaken via body.userId.
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const sessionUserId = (session!.user as any).id;
  const role = (session!.user as any).role;

  try {
    const body = await req.json();
    const { type, customName, expiryDate, fileUrl, userId: bodyUserId } = body;

    if (!type || !expiryDate) {
      return NextResponse.json({ error: 'type en expiryDate zijn verplicht' }, { status: 400 });
    }

    const validTypes = ['VCA', 'VCA_VOL', 'MANGATWACHT', 'GASMETEN', 'BHV', 'EHBO', 'RESCUE', 'ANDERS'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Ongeldig certificaattype' }, { status: 400 });
    }

    if (type === 'ANDERS' && !customName?.trim()) {
      return NextResponse.json({ error: 'Vul een naam in voor het certificaat' }, { status: 400 });
    }

    if ((role === 'ADMIN' || role === 'MANAGER') && !bodyUserId) {
      return NextResponse.json({ error: 'Selecteer een medewerker' }, { status: 400 });
    }

    const targetUserId =
      bodyUserId && (role === 'ADMIN' || role === 'MANAGER') ? bodyUserId : sessionUserId;

    const certificaat = await prisma.certificaat.create({
      data: {
        userId: targetUserId,
        type,
        customName: type === 'ANDERS' ? customName.trim() : null,
        expiryDate: new Date(expiryDate),
        fileUrl: fileUrl || null,
      },
    });

    return NextResponse.json(certificaat, { status: 201 });
  } catch (err) {
    console.error('Certificaten POST error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
