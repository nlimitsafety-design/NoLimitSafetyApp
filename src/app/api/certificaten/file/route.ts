import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

// Only proxy requests to Vercel Blob — never to arbitrary hosts. Without this
// check any authenticated user could pass ?url=https://attacker.example and the
// server would forward BLOB_READ_WRITE_TOKEN as a Bearer header (SSRF + token leak).
function isVercelBlobUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Geen URL opgegeven' }, { status: 400 });

  if (!isVercelBlobUrl(url)) {
    return NextResponse.json({ error: 'Ongeldige bestands-URL' }, { status: 400 });
  }

  // The URL must belong to a known certificate, and the caller must own it
  // (or be ADMIN/MANAGER). Prevents reading another employee's certificate file
  // by passing its blob URL directly.
  const cert = await prisma.certificaat.findFirst({ where: { fileUrl: url } });
  if (!cert) {
    return NextResponse.json({ error: 'Bestand niet gevonden' }, { status: 404 });
  }

  const sessionUserId = (session!.user as any).id;
  const role = (session!.user as any).role;
  if (cert.userId !== sessionUserId && role !== 'ADMIN' && role !== 'MANAGER') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: 'Blob token niet geconfigureerd' }, { status: 500 });

  const blobRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!blobRes.ok) {
    return NextResponse.json({ error: 'Bestand niet gevonden' }, { status: 404 });
  }

  const contentType = blobRes.headers.get('content-type') ?? 'application/octet-stream';
  const buffer = await blobRes.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
    },
  });
}
