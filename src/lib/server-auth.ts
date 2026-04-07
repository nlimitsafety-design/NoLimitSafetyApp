import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Niet ingelogd" }, { status: 401 }),
      session: null,
    };
  }
  return { error: null, session };
}

export async function requireRole(roles: string[]) {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };

  const userRole = session!.user.role;
  if (!roles.includes(userRole)) {
    return {
      error: NextResponse.json({ error: "Geen toegang" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session: session! };
}

export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE";
