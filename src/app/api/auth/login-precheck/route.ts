import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCredentials } from "@/lib/credentials";
import {
  readDeviceTokenFromCookieHeader,
  isTrustedDevice,
} from "@/lib/device";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  buildQrDataUrl,
} from "@/lib/totp";

export const runtime = "nodejs";

/**
 * Stap 1 van inloggen. Verifieert email+wachtwoord en bepaalt wat er nog moet
 * gebeuren voordat de sessie aangemaakt mag worden:
 *  - "ok"        : dit apparaat is al vertrouwd -> client roept direct signIn aan
 *  - "totp"      : authenticator al gekoppeld, voer de actuele code in
 *  - "enroll"    : eerste keer -> scan de QR en bevestig met een code
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Ongeldige inloggegevens" },
      { status: 401 },
    );
  }

  // Apparaat al vertrouwd? Dan is er geen tweede factor nodig.
  const deviceToken = readDeviceTokenFromCookieHeader(
    req.headers.get("cookie"),
  );
  if (await isTrustedDevice(user.id, deviceToken)) {
    return NextResponse.json({ status: "ok" });
  }

  // Authenticator al gekoppeld -> alleen een code invoeren.
  if (user.totpEnabled && user.totpSecret) {
    return NextResponse.json({ status: "totp" });
  }

  // Eerste inlog: lever de QR aan. Hergebruik een nog-niet-bevestigd secret
  // (zodat een al gescande QR geldig blijft als precheck nogmaals draait);
  // genereer alleen een nieuw secret als er nog geen is.
  const secret = user.totpSecret ?? generateTotpSecret();
  if (!user.totpSecret) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret, totpEnabled: false },
    });
  }
  const otpauth = buildOtpAuthUrl(user.email, secret);
  const qr = await buildQrDataUrl(otpauth);

  return NextResponse.json({
    status: "enroll",
    qr,
    // Handmatige invoer als de QR niet gescand kan worden
    manualKey: secret,
  });
}
