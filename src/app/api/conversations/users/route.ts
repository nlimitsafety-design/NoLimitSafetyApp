import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

export async function GET() {
  const { error } = await requireRole(['ADMIN', 'MANAGER', 'EMPLOYEE']);
  if (error) return error;

  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userFuncties: {
          select: { functie: { select: { id: true, name: true, color: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const mapped = users.map(u => ({
      ...u,
      functies: u.userFuncties.map(uf => uf.functie),
      userFuncties: undefined,
    }));

    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
