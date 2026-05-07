import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import BerichtenClient from './BerichtenClient';

export default async function BerichtenPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';
  return <BerichtenClient isAdmin={isAdmin} />;
}
