import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

/**
 * PUT /api/certificaten/[id]
 * Bijwerken van een certificaat (type, expiryDate, customName).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const sessionUserId = (session!.user as any).id;
  const role = (session!.user as any).role;

  try {
    const cert = await prisma.certificaat.findUnique({ where: { id: params.id } });
    if (!cert) {
      return NextResponse.json({ error: 'Certificaat niet gevonden' }, { status: 404 });
    }
    if (cert.userId !== sessionUserId && role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await req.json();
    const { type, customName, expiryDate } = body;

    const validTypes = ['VCA', 'VCA_VOL', 'MANGATWACHT', 'GASMETEN', 'BHV', 'EHBO', 'RESCUE', 'ANDERS'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Ongeldig certificaattype' }, { status: 400 });
    }

    const updated = await prisma.certificaat.update({
      where: { id: params.id },
      data: {
        ...(type && { type }),
        ...(type === 'ANDERS' ? { customName: customName?.trim() || null } : type ? { customName: null } : {}),
        ...(expiryDate && {
          expiryDate: new Date(expiryDate),
          notifiedSoon: false,
          notifiedExpired: false,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Certificaten PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * DELETE /api/certificaten/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const sessionUserId = (session!.user as any).id;
  const role = (session!.user as any).role;

  try {
    const cert = await prisma.certificaat.findUnique({ where: { id: params.id } });
    if (!cert) {
      return NextResponse.json({ error: 'Certificaat niet gevonden' }, { status: 404 });
    }
    if (cert.userId !== sessionUserId && role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    await prisma.certificaat.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Certificaten DELETE error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
