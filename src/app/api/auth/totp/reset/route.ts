import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server-auth";

export const runtime = "nodejs";

/**
 * Admin reset de tweede factor van een gebruiker (bv. bij verlies van de
 * telefoon). De authenticator-koppeling en alle vertrouwde apparaten worden
 * gewist; bij de volgende inlog moet de gebruiker opnieuw koppelen.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId ontbreekt" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.trustedDevice.deleteMany({ where: { userId: body.userId } }),
    prisma.user.update({
      where: { id: body.userId },
      data: { totpSecret: null, totpEnabled: false },
    }),
  ]);

  return NextResponse.json({ status: "ok" });
}
