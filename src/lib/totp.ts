import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

// Naam die in de authenticator-app naast de code verschijnt
const ISSUER = "NoLimit Safety";
// Sta ±30s klokverschil toe (één tijdstap drift) op telefoons
const EPOCH_TOLERANCE = 30;

/** Genereer een nieuw base32 TOTP-secret voor een gebruiker. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth://-URL die in de QR-code gestopt wordt zodat de app het secret kan inlezen. */
export function buildOtpAuthUrl(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

/** Maak een data-URL (PNG) van de QR-code voor de otpauth-URL. */
export async function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
}

/** Controleer een 6-cijferige code tegen het secret. */
export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const clean = token.replace(/\s/g, "");
  try {
    const result = await verify({
      secret,
      token: clean,
      epochTolerance: EPOCH_TOLERANCE,
    });
    return result.valid;
  } catch {
    return false;
  }
}
