import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

/**
 * PUT /api/shift-requests/[id]
 * Admin approves or rejects a shift request
 * Body: { action: 'APPROVED' | 'REJECTED' }
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireRole(['ADMIN']);
  if (error) return error;

  const adminId = (session!.user as any).id;

  try {
    const { action } = await req.json();

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });
    }

    const request = await prisma.shiftRequest.findUnique({
      where: { id: params.id },
      include: { shift: true },
    });

    if (!request) {
      return NextResponse.json({ error: 'Aanvraag niet gevonden' }, { status: 404 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Aanvraag is al verwerkt' }, { status: 400 });
    }

    if (action === 'APPROVED') {
      // Approve: assign user to shift, reject all other pending requests, change shift status
      await prisma.$transaction(async (tx) => {
        // Update this request to APPROVED
        await tx.shiftRequest.update({
          where: { id: params.id },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: adminId,
          },
        });

        // Reject all other PENDING requests for this shift
        await tx.shiftRequest.updateMany({
          where: {
            shiftId: request.shiftId,
            id: { not: params.id },
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedBy: adminId,
          },
        });

        // Assign the user to the shift
        await tx.shiftUser.create({
          data: {
            shiftId: request.shiftId,
            userId: request.userId,
          },
        });

        // Change shift status to TOEGEWEZEN
        await tx.shift.update({
          where: { id: request.shiftId },
          data: { status: 'TOEGEWEZEN' },
        });
      });

      return NextResponse.json({ success: true, message: 'Aanvraag geaccepteerd' });
    } else {
      // Reject this single request
      await prisma.shiftRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: adminId,
        },
      });

      return NextResponse.json({ success: true, message: 'Aanvraag afgewezen' });
    }
  } catch (err) {
    console.error('Shift request PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
