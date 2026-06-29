import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { readDeviceTokenFromCookieHeader, isTrustedDevice } from "./device";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email en wachtwoord zijn verplicht");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.active) {
          throw new Error("Ongeldige inloggegevens");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!isValid) {
          throw new Error("Ongeldige inloggegevens");
        }

        // Tweede factor: dit apparaat moet eerder via de authenticator zijn
        // geverifieerd (eerste inlog = koppelen, nieuw apparaat = code invoeren).
        // De koppel-/verifieer-endpoints zetten daarna het apparaat-cookie; pas
        // daarna mag signIn slagen. Dit blokkeert het overslaan van de 2FA-stap.
        const deviceToken = readDeviceTokenFromCookieHeader(
          req?.headers?.cookie as string | undefined,
        );
        const trusted = await isTrustedDevice(user.id, deviceToken);
        if (!trusted) {
          throw new Error("DEVICE_NOT_VERIFIED");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "ADMIN" | "MANAGER" | "EMPLOYEE",
          rememberMe: credentials.rememberMe === "true",
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Always allow relative URLs — resolve against the actual baseUrl
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin redirects
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // invalid URL — fall through to baseUrl
      }
      return baseUrl;
    },
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.rememberMe = user.rememberMe || false;
        // Set initial expiry based on rememberMe choice
        if ((user as any).rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60; // 8 hours
        }
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (for "ingelogd blijven"); JWT callback limits non-remember sessions
  },
  secret: process.env.NEXTAUTH_SECRET,
};
