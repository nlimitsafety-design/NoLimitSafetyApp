import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCredentials, allowAttempt, clearAttempts } from "@/lib/credentials";
import { verifyTotp } from "@/lib/totp";
import { createTrustedDevice, deviceCookieOptions, DEVICE_COOKIE } from "@/lib/device";

export const runtime = "nodejs";

/**
 * Stap 2a — eerste inlog: bevestig de koppeling van de authenticator.
 * Verwacht email+wachtwoord (opnieuw) en de eerste code uit de app. Bij succes
 * wordt totpEnabled gezet en dit apparaat als vertrouwd geregistreerd.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";
  const code = body.code || "";

  if (!allowAttempt(`confirm:${email}`)) {
    return NextResponse.json(
      { error: "Te veel pogingen. Probeer het later opnieuw." },
      { status: 429 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 401 });
  }
  if (!user.totpSecret) {
    return NextResponse.json(
      { error: "Geen koppeling in behandeling. Start opnieuw." },
      { status: 400 },
    );
  }

  if (!(await verifyTotp(code, user.totpSecret))) {
    return NextResponse.json(
      { error: "Onjuiste code. Controleer de app en probeer opnieuw." },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });
  clearAttempts(`confirm:${email}`);

  const token = await createTrustedDevice(user.id, req.headers.get("user-agent"));
  const res = NextResponse.json({ status: "ok" });
  res.cookies.set(DEVICE_COOKIE, token, deviceCookieOptions());
  return res;
}
