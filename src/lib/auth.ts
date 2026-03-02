import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Wachtwoord', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email en wachtwoord zijn verplicht');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.active) {
          throw new Error('Ongeldige inloggegevens');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Ongeldige inloggegevens');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          rememberMe: credentials.rememberMe === 'true',
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Always allow relative URLs — resolve against the actual baseUrl
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allow same-origin redirects
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // invalid URL — fall through to baseUrl
      }
      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.rememberMe = (user as any).rememberMe || false;
        // Set initial expiry based on rememberMe choice
        if ((user as any).rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60; // 8 hours
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days (for "ingelogd blijven"); JWT callback limits non-remember sessions
  },
  secret: process.env.NEXTAUTH_SECRET,
};
