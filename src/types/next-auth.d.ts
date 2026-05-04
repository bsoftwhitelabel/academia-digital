import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      firstName: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    tenantId: string;
    firstName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
    firstName: string;
  }
}
