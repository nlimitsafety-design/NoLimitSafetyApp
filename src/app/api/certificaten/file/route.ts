import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Geen URL opgegeven' }, { status: 400 });

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
