import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { createNotification, createNotifications } from '@/lib/notifications';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

function certLabel(type: string, customName?: string | null): string {
  const labels: Record<string, string> = {
    VCA: 'VCA',
    VCA_VOL: 'VCA VOL',
    MANGATWACHT: 'Mangatwacht',
    GASMETEN: 'Gasmeten',
    BHV: 'BHV',
    EHBO: 'EHBO',
    RESCUE: 'Rescue',
    ANDERS: customName || 'Overig',
  };
  return labels[type] ?? type;
}

/**
 * GET /api/certificaten/check-expiry
 * Controleer alle certificaten op verloop en stuur meldingen:
 * - 3 maanden van tevoren: melding aan medewerker
 * - Verlopen: melding aan medewerker én alle admins
 *
 * Veilig om meerdere keren aan te roepen — bijhoudt welke meldingen al verstuurd zijn.
 */
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const role = (session!.user as any).role;
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
  }

  try {
    const now = new Date();
    const threeMonthsFromNow = new Date(now);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    // Certificaten die bijna verlopen zijn (binnen 3 maanden) en nog geen melding ontvangen hebben
    const expiringSoon = await prisma.certificaat.findMany({
      where: {
        expiryDate: { gt: now, lte: threeMonthsFromNow },
        notifiedSoon: false,
      },
      include: { user: true },
    });

    // Certificaten die al verlopen zijn en nog geen verlopen-melding ontvangen hebben
    const expired = await prisma.certificaat.findMany({
      where: {
        expiryDate: { lte: now },
        notifiedExpired: false,
      },
      include: { user: true },
    });

    // Alle admins ophalen voor de verlopen-meldingen
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', active: true },
      select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);

    let soonCount = 0;
    let expiredCount = 0;

    // Meldingen voor bijna-verlopen certificaten
    for (const cert of expiringSoon) {
      const label = certLabel(cert.type, cert.customName);
      const dateStr = format(cert.expiryDate, 'd MMMM yyyy', { locale: nl });

      await createNotification({
        userId: cert.userId,
        type: 'CERT_EXPIRING_SOON',
        title: 'Certificaat verloopt binnenkort',
        message: `Je ${label} certificaat verloopt op ${dateStr}. Zorg voor tijdige verlenging.`,
      });

      await prisma.certificaat.update({
        where: { id: cert.id },
        data: { notifiedSoon: true },
      });
      soonCount++;
    }

    // Meldingen voor verlopen certificaten
    for (const cert of expired) {
      const label = certLabel(cert.type, cert.customName);
      const dateStr = format(cert.expiryDate, 'd MMMM yyyy', { locale: nl });

      // Melding aan medewerker zelf
      await createNotification({
        userId: cert.userId,
        type: 'CERT_EXPIRED',
        title: 'Certificaat verlopen',
        message: `Je ${label} certificaat is verlopen op ${dateStr}. Neem contact op met je leidinggevende.`,
      });

      // Melding aan alle admins (behalve als de medewerker zelf admin is)
      const adminIdsToNotify = adminIds.filter((id) => id !== cert.userId);
      if (adminIdsToNotify.length > 0) {
        await createNotifications(
          adminIdsToNotify,
          'CERT_EXPIRED',
          'Certificaat medewerker verlopen',
          `Het ${label} certificaat van ${cert.user.name} is verlopen op ${dateStr}.`,
        );
      }

      await prisma.certificaat.update({
        where: { id: cert.id },
        data: { notifiedExpired: true },
      });
      expiredCount++;
    }

    return NextResponse.json({
      checked: expiringSoon.length + expired.length,
      notifiedSoon: soonCount,
      notifiedExpired: expiredCount,
    });
  } catch (err) {
    console.error('Check-expiry error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
