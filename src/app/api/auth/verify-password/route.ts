import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const { password } = await req.json().catch(() => ({}));
  if (!password) return NextResponse.json({ ok: false, error: "Password obrigatória" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return NextResponse.json({ ok: false }, { status: 400 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  return NextResponse.json({ ok: valid });
}
