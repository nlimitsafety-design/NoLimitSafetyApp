import crypto from "crypto";
import { prisma } from "./prisma";

// Cookie waarin het random token van een vertrouwd apparaat staat
export const DEVICE_COOKIE = "nls_device";
// Hoe lang een apparaat vertrouwd blijft (1 jaar)
export const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;

/** Genereer een nieuw, onvoorspelbaar apparaat-token (komt in de cookie). */
export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Hash van het token zoals het in de database wordt bewaard (nooit het token zelf opslaan). */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Cookie-opties voor het zetten van het apparaat-token. */
export function deviceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEVICE_MAX_AGE,
  };
}

/** Lees het apparaat-token uit een rauwe Cookie-header (gebruikt in NextAuth authorize). */
export function readDeviceTokenFromCookieHeader(
  cookieHeader: string | undefined | null,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === DEVICE_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Controleer of het token bij een vertrouwd apparaat van deze gebruiker hoort.
 * Werkt lastUsedAt bij wanneer het klopt.
 */
export async function isTrustedDevice(
  userId: string,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashDeviceToken(token);
  const device = await prisma.trustedDevice.findUnique({ where: { tokenHash } });
  if (!device || device.userId !== userId) return false;
  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  });
  return true;
}

/**
 * Registreer dit apparaat als vertrouwd voor de gebruiker en geef het ruwe
 * token terug (dat in de cookie gezet moet worden door de route).
 */
export async function createTrustedDevice(
  userId: string,
  userAgent: string | null | undefined,
): Promise<string> {
  const token = generateDeviceToken();
  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: hashDeviceToken(token),
      label: describeDevice(userAgent),
    },
  });
  return token;
}

/** Maak een korte, leesbare omschrijving van het apparaat o.b.v. de user-agent. */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent || "";
  let os = "Onbekend apparaat";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  return browser ? `${os} · ${browser}` : os;
}
