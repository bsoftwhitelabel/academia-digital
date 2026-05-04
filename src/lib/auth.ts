import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "./audit";
import crypto from "crypto";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NEXTAUTH_DEBUG === "1",
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
        const anon = (v?: string | null) =>
          v
            ? crypto.createHash("sha256").update(v).digest("hex").slice(0, 10)
            : "—";
        // Recolher IP e UA para auditoria
        const headers = (req?.headers || {}) as Record<string, string>;
        const ip =
          (headers["x-forwarded-for"] || "").split(",")[0].trim() ||
          headers["x-real-ip"] ||
          null;
        const ua = headers["user-agent"] || null;

        try {
          // Fluxo de Magic Link
          if (credentials?.magicToken) {
            const magicLink = await prisma.magicLink.findUnique({
              where: { token: credentials.magicToken },
              include: { user: true },
            });

            if (!magicLink || magicLink.expiresAt < new Date() || magicLink.usedAt) {
              console.warn("[auth] magic-link invalid", {
                token: anon(credentials.magicToken),
              });
              return null; // Link inválido, expirado ou já utilizado
            }

            // Marcar como utilizado
            await prisma.magicLink.update({
              where: { id: magicLink.id },
              data: { usedAt: new Date() },
            });

            console.info("[auth] magic-link ok", { user: anon(magicLink.user.email) });
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
            console.warn("[auth] credentials missing");
            return null;
          }

          const requestedEmail = String(credentials.email).trim().toLowerCase();
          const aliasEmails =
            requestedEmail === "admin.s5@oportoforte.com"
              ? [requestedEmail, "admin@oportoforte.com"]
              : requestedEmail === "admin@oportoforte.com"
                ? [requestedEmail, "admin.s5@oportoforte.com"]
                : [requestedEmail];

          let user: {
            id: string;
            email: string;
            role: any;
            tenantId: string;
            firstName: string;
            passwordHash: string | null;
          } | null = null;

          for (const email of aliasEmails) {
            user = await prisma.user.findUnique({
              where: { email },
            });
            if (user) break;
          }

          if (!user) {
            console.warn("[auth] user not found", { email: anon(requestedEmail) });
            return null;
          }
          if (!user.passwordHash) {
            console.warn("[auth] user has no passwordHash", { email: anon(requestedEmail) });
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            console.warn("[auth] invalid password", { email: anon(requestedEmail) });
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

          console.info("[auth] credentials ok", { user: anon(user.email) });
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            firstName: user.firstName,
          };
        } catch (e) {
          console.error("[auth] authorize error", e);
          return null;
        }
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
