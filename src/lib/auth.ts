import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "./audit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        magicToken: { label: "Magic Token", type: "text" },
      },
      async authorize(credentials, req) {
        // Recolher IP e UA para auditoria
        const headers = (req?.headers || {}) as Record<string, string>;
        const ip =
          (headers["x-forwarded-for"] || "").split(",")[0].trim() ||
          headers["x-real-ip"] ||
          null;
        const ua = headers["user-agent"] || null;

        // Fluxo de Magic Link
        if (credentials?.magicToken) {
          const magicLink = await prisma.magicLink.findUnique({
            where: { token: credentials.magicToken },
            include: { user: true },
          });

          if (!magicLink || magicLink.expiresAt < new Date() || magicLink.usedAt) {
            return null; // Link inválido, expirado ou já utilizado
          }

          // Marcar como utilizado
          await prisma.magicLink.update({
            where: { id: magicLink.id },
            data: { usedAt: new Date() },
          });

          return {
            id: magicLink.user.id,
            email: magicLink.user.email,
            role: magicLink.user.role,
            tenantId: magicLink.user.tenantId,
            firstName: magicLink.user.firstName,
          };
        }

        // Fluxo normal (Email/Password)
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // Log LOGIN no AuditLog (best-effort)
        await logAudit({
          action: "LOGIN",
          resource: "User",
          resourceId: user.id,
          userId: user.id,
          tenantId: user.tenantId,
          ip: ip ?? undefined,
          userAgent: ua ?? undefined,
        });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          firstName: user.firstName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.firstName = user.firstName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.firstName = token.firstName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
