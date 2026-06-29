import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/**
 * Verifieer email + wachtwoord. Geeft de gebruiker terug bij succes, anders null.
 * Wordt gebruikt door de 2FA-endpoints (precheck/confirm/verify) voordat we een
 * code of QR tonen of het apparaat vertrouwd maken.
 */
export async function verifyCredentials(email: string, password: string) {
  if (!email || !password) return null;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

// --- Eenvoudige in-memory rate limiting voor code-pogingen (best-effort) ---
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minuten
const MAX_ATTEMPTS = 8;

/** Geeft true als er nog een poging mag; registreert de poging. */
export function allowAttempt(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

/** Reset de teller na een geslaagde verificatie. */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}
