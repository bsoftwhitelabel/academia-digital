import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ALLOWED_KEYS = new Set([
  "RESEND_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID",
  "NEXTAUTH_SECRET",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { key, password } = await req.json().catch(() => ({}));
  if (!key || !password) {
    return NextResponse.json({ ok: false, error: "key e password obrigatórios" }, { status: 400 });
  }
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ ok: false, error: "key não permitida" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return NextResponse.json({ ok: false, error: "Password incorrecta" }, { status: 401 });

  const value = process.env[key] || "";
  return NextResponse.json({ ok: true, value });
}
