import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { requireAuth } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as any).id;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const certId = formData.get('certId') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'Bestand is te groot (max 10 MB)' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Alleen JPG, PNG, WEBP of PDF toegestaan' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const filename = `certificaten/${userId}/${certId ?? 'new'}-${Date.now()}.${ext}`;

  try {
    const blob = await put(filename, file, { access: 'private' });
    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    console.error('Blob upload error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Upload mislukt' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'Geen URL' }, { status: 400 });

  await del(url);
  return NextResponse.json({ ok: true });
}
