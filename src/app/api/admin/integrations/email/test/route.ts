import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import * as React from "react";

function PlainEmail({ message }: { message: string }) {
  return React.createElement("div", { style: { fontFamily: "sans-serif", padding: 16 } }, message);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, firstName: true },
  });
  if (!user?.email) return NextResponse.json({ error: "Sem email" }, { status: 400 });

  await sendEmail({
    to: user.email,
    subject: `[Teste] Integração Email — Academia Digital`,
    template: PlainEmail as any,
    data: { message: `Olá ${user.firstName}, esta é uma mensagem de teste de email. Integração OK.` } as any,
    tenantId: session.user.tenantId,
    event: "INQUIRY_RECEIVED",
  });
  return NextResponse.json({ success: true, sentTo: user.email });
}
